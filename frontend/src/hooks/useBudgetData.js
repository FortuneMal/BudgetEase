import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../utils/supabase';
import { useToast } from '../context/ToastContext';
import { friendlyError } from '../lib/errors';
import { todayISO } from '../lib/format';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, guessIconForName } from '../lib/categories';

const TABLES = ['expenses', 'income', 'categories', 'goals', 'goal_contributions'];
const ORDER = {
  expenses: ['occurred_on', false],
  income: ['occurred_on', false],
  categories: ['sort_order', true],
  goals: ['created_at', true],
  goal_contributions: ['occurred_on', false],
};

const isMissingSchema = (err) => {
  const m = String(err?.message || '').toLowerCase();
  return m.includes('schema cache') || m.includes('does not exist') || err?.code === '42P01' || err?.code === '42703';
};

const UNDO_MS = 6000;

// One in-flight setup per user, so React StrictMode's double effects (or a quick
// remount) can't seed categories or move legacy data twice.
const setupRuns = new Map();

/**
 * Loads and mutates all of a user's budgeting data. Mutations update local state
 * first (so the UI feels instant) and roll back with a friendly toast on failure.
 */
export default function useBudgetData(user) {
  const { toast } = useToast();
  const userId = user?.id;

  const [data, setData] = useState({ expenses: [], income: [], categories: [], goals: [], goal_contributions: [] });
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);

  // ids hidden locally while their "Undo" toast is showing
  const pendingDeletes = useRef(new Set());

  const setTable = useCallback((table, updater) => {
    setData((prev) => ({ ...prev, [table]: typeof updater === 'function' ? updater(prev[table]) : updater }));
  }, []);

  const fetchTable = useCallback(async (table) => {
    const [col, asc] = ORDER[table];
    const { data: rows, error } = await supabase.from(table).select('*').eq('user_id', userId).order(col, { ascending: asc });
    if (error) throw error;
    const visible = rows.filter((r) => !pendingDeletes.current.has(r.id));
    setTable(table, visible);
    return visible;
  }, [userId, setTable]);

  const fail = useCallback((err) => {
    console.error(err);
    toast({ tone: 'error', message: friendlyError(err) });
  }, [toast]);

  // ---------- first load, seeding and legacy migration ----------
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      try {
        const results = await Promise.all(TABLES.map((t) => fetchTable(t)));
        if (cancelled) return;
        const [expenses, income, categories, goals] = results;
        if (!setupRuns.has(userId)) {
          setupRuns.set(userId, migrateLegacy({ user, expenses, income, categories, goals }).catch((err) => {
            setupRuns.delete(userId);
            throw err;
          }));
        }
        await setupRuns.get(userId);
        if (!cancelled) await Promise.all(['categories', 'income', 'goals'].map((t) => fetchTable(t)));
      } catch (err) {
        if (isMissingSchema(err)) {
          setNeedsMigration(true);
          // Expenses existed before the migration; show them so the app is still usable.
          try {
            const { data: rows } = await supabase.from('expenses').select('*').eq('user_id', userId).order('created_at', { ascending: false });
            setTable('expenses', (rows || []).map((r) => ({ ...r, occurred_on: r.occurred_on || String(r.created_at).slice(0, 10) })));
          } catch { /* nothing more we can do */ }
        } else {
          fail(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Moves data that older versions kept in auth user_metadata into real tables,
    // and creates default categories for brand-new users.
    const migrateLegacy = async ({ user: u, expenses, income, categories, goals }) => {
      const meta = u.user_metadata || {};
      const legacyBudgets = meta.categoryBudgets || {};
      const legacyIncome = Array.isArray(meta.income) ? meta.income : [];
      const legacyGoals = Array.isArray(meta.goals) ? meta.goals : [];

      if (categories.length === 0) {
        const names = new Set(DEFAULT_EXPENSE_CATEGORIES.map((c) => c.name));
        const extra = [...new Set([...expenses.map((e) => e.category), ...Object.keys(legacyBudgets)])].filter(
          (n) => n && !names.has(n)
        );
        const rows = [
          ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({ kind: 'expense', name: c.name, icon: c.icon, sort_order: i })),
          ...extra.map((n, i) => ({ kind: 'expense', name: n, icon: guessIconForName(n), sort_order: 100 + i })),
          ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({ kind: 'income', name: c.name, icon: c.icon, sort_order: i })),
        ].map((r) => ({ ...r, user_id: userId, budget: legacyBudgets[r.name] > 0 && r.kind === 'expense' ? legacyBudgets[r.name] : null }));
        const { error } = await supabase.from('categories').upsert(rows, { onConflict: 'user_id,kind,name', ignoreDuplicates: true });
        if (error) throw error;
      }

      if (income.length === 0 && legacyIncome.length > 0) {
        const rows = legacyIncome.map((i) => ({
          user_id: userId,
          source: i.source || 'Income',
          amount: Number(i.amount) || 0,
          category: i.category || 'Salary',
          occurred_on: String(i.date || todayISO()).slice(0, 10),
        }));
        const { error } = await supabase.from('income').insert(rows);
        if (error) throw error;
      }

      if (goals.length === 0 && legacyGoals.length > 0) {
        const rows = legacyGoals
          .filter((g) => Number(g.target) > 0)
          .map((g) => ({ user_id: userId, name: g.name || 'Goal', target: Number(g.target) }));
        if (rows.length) {
          const { error } = await supabase.from('goals').insert(rows);
          if (error) throw error;
        }
      }

      if (meta.categoryBudgets || meta.income || meta.goals) {
        await supabase.auth.updateUser({ data: { categoryBudgets: null, income: null, goals: null } });
      }
    };

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ---------- realtime: keep devices in sync ----------
  useEffect(() => {
    if (!userId || needsMigration) return;
    const channel = supabase.channel(`budget-${userId}`);
    TABLES.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` }, () => {
        fetchTable(table).catch(() => {});
      });
    });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, needsMigration, fetchTable]);

  // ---------- generic helpers ----------
  const insertRow = useCallback(async (table, row) => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimistic = { ...row, id: tempId, user_id: userId, created_at: new Date().toISOString() };
    setTable(table, (rows) => [optimistic, ...rows]);
    const { data: saved, error } = await supabase.from(table).insert({ ...row, user_id: userId }).select().single();
    if (error) {
      setTable(table, (rows) => rows.filter((r) => r.id !== tempId));
      fail(error);
      return null;
    }
    setTable(table, (rows) => rows.map((r) => (r.id === tempId ? saved : r)));
    return saved;
  }, [userId, setTable, fail]);

  const insertRows = useCallback(async (table, rows) => {
    if (!rows.length) return [];
    const { data: saved, error } = await supabase.from(table).insert(rows.map((r) => ({ ...r, user_id: userId }))).select();
    if (error) { fail(error); return null; }
    setTable(table, (prev) => [...saved, ...prev]);
    return saved;
  }, [userId, setTable, fail]);

  const updateRow = useCallback(async (table, id, patch) => {
    let before;
    setTable(table, (rows) => rows.map((r) => {
      if (r.id !== id) return r;
      before = r;
      return { ...r, ...patch };
    }));
    const { error } = await supabase.from(table).update(patch).eq('id', id);
    if (error) {
      if (before) setTable(table, (rows) => rows.map((r) => (r.id === id ? before : r)));
      fail(error);
      return false;
    }
    return true;
  }, [setTable, fail]);

  /**
   * Hide the row now, show "Undo", and delete for real when the toast expires.
   * `afterDelete` runs only once the delete is final (e.g. remove a receipt file).
   */
  const deleteWithUndo = useCallback((table, row, message, afterDelete) => {
    pendingDeletes.current.add(row.id);
    setTable(table, (rows) => rows.filter((r) => r.id !== row.id));

    let undone = false;
    toast({
      tone: 'info',
      message,
      duration: UNDO_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          undone = true;
          pendingDeletes.current.delete(row.id);
          setTable(table, (rows) => [row, ...rows]);
        },
      },
      onExpire: async () => {
        if (undone) return;
        const { error } = await supabase.from(table).delete().eq('id', row.id);
        pendingDeletes.current.delete(row.id);
        if (error) {
          setTable(table, (rows) => [row, ...rows]);
          fail(error);
          return;
        }
        afterDelete?.();
      },
    });
  }, [setTable, toast, fail]);

  // ---------- expenses ----------
  const addExpense = useCallback((e) => insertRow('expenses', {
    name: e.name.trim(),
    amount: Number(e.amount),
    category: e.category,
    occurred_on: e.occurred_on || todayISO(),
    isRecurring: Boolean(e.isRecurring),
    receipt_path: e.receipt_path || null,
  }), [insertRow]);

  const updateExpense = useCallback((id, patch) => updateRow('expenses', id, patch), [updateRow]);

  const deleteExpense = useCallback((row) => {
    deleteWithUndo('expenses', row, `Deleted “${row.name}”`, () => {
      if (row.receipt_path) supabase.storage.from('receipts').remove([row.receipt_path]).catch(() => {});
    });
  }, [deleteWithUndo]);

  // ---------- income ----------
  const addIncome = useCallback((i) => insertRow('income', {
    source: i.source.trim(),
    amount: Number(i.amount),
    category: i.category,
    occurred_on: i.occurred_on || todayISO(),
    is_recurring: Boolean(i.is_recurring),
  }), [insertRow]);
  const updateIncome = useCallback((id, patch) => updateRow('income', id, patch), [updateRow]);
  const deleteIncome = useCallback((row) => deleteWithUndo('income', row, `Deleted “${row.source}”`), [deleteWithUndo]);

  // ---------- categories & budgets ----------
  const addCategory = useCallback((c) => insertRow('categories', {
    kind: c.kind,
    name: c.name.trim(),
    icon: c.icon || 'circle',
    budget: c.budget ?? null,
    sort_order: 500,
  }), [insertRow]);

  // Renaming a category also renames it on every entry that uses it.
  const renameCategory = useCallback(async (cat, newName) => {
    const name = newName.trim();
    if (!name || name === cat.name) return true;
    const ok = await updateRow('categories', cat.id, { name });
    if (!ok) return false;
    const table = cat.kind === 'expense' ? 'expenses' : 'income';
    setTable(table, (rows) => rows.map((r) => (r.category === cat.name ? { ...r, category: name } : r)));
    const { error } = await supabase.from(table).update({ category: name }).eq('user_id', userId).eq('category', cat.name);
    if (error) fail(error);
    return !error;
  }, [updateRow, setTable, userId, fail]);

  const updateCategory = useCallback((id, patch) => updateRow('categories', id, patch), [updateRow]);
  const setBudget = useCallback((cat, amount) => updateRow('categories', cat.id, { budget: amount }), [updateRow]);

  const setBudgetsBulk = useCallback(async (pairs) => {
    // pairs: [{ id, budget }]
    setTable('categories', (rows) => rows.map((r) => {
      const p = pairs.find((x) => x.id === r.id);
      return p ? { ...r, budget: p.budget } : r;
    }));
    const results = await Promise.all(pairs.map((p) => supabase.from('categories').update({ budget: p.budget }).eq('id', p.id)));
    const err = results.find((r) => r.error)?.error;
    if (err) { fail(err); fetchTable('categories').catch(() => {}); return false; }
    return true;
  }, [setTable, fail, fetchTable]);

  // ---------- goals ----------
  const addGoal = useCallback((g) => insertRow('goals', {
    name: g.name.trim(),
    target: Number(g.target),
    target_date: g.target_date || null,
  }), [insertRow]);
  const updateGoal = useCallback((id, patch) => updateRow('goals', id, patch), [updateRow]);
  const deleteGoal = useCallback(async (goal) => {
    const { error } = await supabase.from('goals').delete().eq('id', goal.id);
    if (error) { fail(error); return false; }
    setTable('goals', (rows) => rows.filter((r) => r.id !== goal.id));
    setTable('goal_contributions', (rows) => rows.filter((r) => r.goal_id !== goal.id));
    return true;
  }, [setTable, fail]);

  const addContribution = useCallback((c) => insertRow('goal_contributions', {
    goal_id: c.goal_id,
    amount: Number(c.amount),
    occurred_on: c.occurred_on || todayISO(),
    note: c.note || null,
  }), [insertRow]);
  const deleteContribution = useCallback((row) => deleteWithUndo('goal_contributions', row, 'Removed that goal entry'), [deleteWithUndo]);

  // ---------- account-wide ----------
  const convertAllAmounts = useCallback(async (rate) => {
    const { error } = await supabase.rpc('convert_user_amounts', { rate });
    if (error) { fail(error); return false; }
    await Promise.all(TABLES.map((t) => fetchTable(t)));
    return true;
  }, [fail, fetchTable]);

  const expenseCategories = useMemo(
    () => data.categories.filter((c) => c.kind === 'expense' && !c.archived),
    [data.categories]
  );
  const incomeCategories = useMemo(
    () => data.categories.filter((c) => c.kind === 'income' && !c.archived),
    [data.categories]
  );

  return {
    ...data,
    expenseCategories,
    incomeCategories,
    loading,
    needsMigration,
    addExpense, updateExpense, deleteExpense,
    addIncome, updateIncome, deleteIncome,
    addCategory, renameCategory, updateCategory, setBudget, setBudgetsBulk,
    addGoal, updateGoal, deleteGoal, addContribution, deleteContribution,
    insertRows, convertAllAmounts,
  };
}
