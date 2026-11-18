import React, { useMemo, useState } from 'react';
import { Plus, X, Wand2, Loader2, Settings2 } from 'lucide-react';
import Modal from './ui/Modal';
import CategoryIcon from './ui/CategoryIcon';
import { monthSummary } from '../lib/insights';
import { formatMoney, daysInMonth, MONTHS } from '../lib/format';
import { suggestBudgets, TEMPLATE_SAVINGS_SHARE } from '../lib/budgetTemplate';
import { entriesForMonth, isRecurringItem } from '../lib/recurring';
import { useToast } from '../context/ToastContext';

const BudgetRow = ({ cat, spent, currency, onSave, onClear, paceDays }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const budget = Number(cat.budget) || 0;
  const pct = budget > 0 ? (spent / budget) * 100 : 0;
  const over = budget > 0 && spent > budget;
  const warn = !over && pct >= 85;
  const left = budget - spent;

  const start = () => { setValue(budget ? String(budget) : ''); setEditing(true); };
  const commit = async () => {
    const n = parseFloat(value);
    setEditing(false);
    if (value === '' || !(n >= 0) || n === budget) return;
    await onSave(cat, n === 0 ? null : n);
  };

  return (
    <li className="py-4 border-b border-obsidian-700/60 last:border-0">
      <div className="flex items-center gap-3">
        <CategoryIcon iconKey={cat.icon} size={16} className="!p-2" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-platinum-100 truncate">{cat.name}</p>
          <p className={`text-sm ${over ? 'text-red-400' : warn ? 'text-gold-500' : 'text-platinum-500'}`}>
            {budget > 0
              ? over
                ? `${formatMoney(-left, currency)} over budget`
                : `${formatMoney(left, currency)} left${paceDays > 0 ? ` · about ${formatMoney(left / paceDays, currency)} a day` : ''}`
              : spent > 0 ? 'No budget set' : 'No budget'}
          </p>
        </div>

        {editing ? (
          <input
            className="input !w-32 !py-2 text-right"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
            aria-label={`Monthly budget for ${cat.name}`}
          />
        ) : (
          <button onClick={start} className="text-right rounded-lg px-2 py-1 hover:bg-obsidian-700/60" title="Change budget">
            <span className="block font-semibold text-white tabular-nums">{formatMoney(spent, currency)}</span>
            <span className="block text-sm text-platinum-500 tabular-nums">{budget > 0 ? `of ${formatMoney(budget, currency)}` : 'Set budget'}</span>
          </button>
        )}
        {budget > 0 && !editing && (
          <button className="icon-btn" onClick={() => onClear(cat)} aria-label={`Remove ${cat.name} budget`} title="Remove budget"><X size={16} /></button>
        )}
      </div>
      {budget > 0 && (
        <div className="mt-3 h-2 rounded-full bg-obsidian-900 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-red-500' : warn ? 'bg-gold-400' : 'bg-gold-gradient'}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
    </li>
  );
};

const BudgetsTab = ({ data, year, month, currency, onManageCategories }) => {
  const { toast } = useToast();
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateIncome, setTemplateIncome] = useState('');
  const [proposal, setProposal] = useState([]);
  const [busy, setBusy] = useState(false);
  const [newCat, setNewCat] = useState('');

  const summary = useMemo(() => monthSummary(data, year, month), [data, year, month]);
  const cats = data.expenseCategories;
  const totalBudget = cats.reduce((s, c) => s + (Number(c.budget) || 0), 0);
  const unbudgeted = Object.entries(summary.byCategory)
    .filter(([name]) => !(Number(cats.find((c) => c.name === name)?.budget) > 0))
    .reduce((s, [, v]) => s + v, 0);

  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
  const paceDays = isCurrentMonth ? daysInMonth(year, month) - now.getDate() + 1 : 0;

  const sorted = [...cats].sort((a, b) => {
    const ab = Number(a.budget) > 0, bb = Number(b.budget) > 0;
    if (ab !== bb) return ab ? -1 : 1;
    return (summary.byCategory[b.name] || 0) - (summary.byCategory[a.name] || 0);
  });

  const save = async (cat, amount) => {
    const ok = await data.setBudget(cat, amount);
    if (ok) toast({ message: amount ? `${cat.name} budget set to ${formatMoney(amount, currency)}` : `${cat.name} budget removed` });
  };

  const clear = async (cat) => {
    const previous = cat.budget;
    const ok = await data.setBudget(cat, null);
    if (ok) toast({ tone: 'info', message: `${cat.name} budget removed`, action: { label: 'Undo', onClick: () => data.setBudget(cat, previous) } });
  };

  const openTemplate = () => {
    const inc = Math.round(summary.earned);
    setTemplateIncome(inc ? String(inc) : '');
    setProposal(inc ? buildProposal(inc) : []);
    setTemplateOpen(true);
  };

  const buildProposal = (income) => {
    const recurring = {};
    entriesForMonth(data.expenses.filter(isRecurringItem), year, month).forEach((e) => {
      recurring[e.category] = (recurring[e.category] || 0) + Number(e.amount);
    });
    return suggestBudgets(income, data.categories.filter((c) => c.kind === 'expense' && !c.archived), recurring);
  };

  const applyTemplate = async () => {
    setBusy(true);
    const ok = await data.setBudgetsBulk(proposal.map((p) => ({ id: p.id, budget: p.budget > 0 ? p.budget : null })));
    setBusy(false);
    if (ok) {
      setTemplateOpen(false);
      toast({ message: 'Budgets set. Tap any amount to adjust it.' });
    }
  };

  const addCategory = async (e) => {
    e.preventDefault();
    const name = newCat.trim();
    if (!name) return;
    if (cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast({ tone: 'error', message: 'You already have a category with that name.' });
      return;
    }
    const saved = await data.addCategory({ kind: 'expense', name });
    if (saved) { setNewCat(''); toast({ message: `Added ${name}` }); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="card-title">Monthly budgets</h2>
            <p className="text-platinum-400 mt-1">Set a limit for each category. They apply every month. Tap an amount to change it.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="btn-ghost !px-4" onClick={onManageCategories}><Settings2 size={16} /> Categories</button>
            <button className="btn-secondary !px-4" onClick={openTemplate}><Wand2 size={16} /> 50/30/20 starter</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-2">
          <div className="rounded-xl bg-obsidian-900/50 border border-obsidian-700 p-4">
            <p className="text-sm text-platinum-400">Budgeted</p>
            <p className="text-lg sm:text-xl font-semibold text-white tabular-nums">{formatMoney(totalBudget, currency)}</p>
          </div>
          <div className="rounded-xl bg-obsidian-900/50 border border-obsidian-700 p-4">
            <p className="text-sm text-platinum-400">Spent in {MONTHS[month].slice(0, 3)}</p>
            <p className="text-lg sm:text-xl font-semibold text-white tabular-nums">{formatMoney(summary.spent, currency)}</p>
          </div>
          <div className={`rounded-xl border p-4 ${totalBudget && summary.spent > totalBudget ? 'border-red-500/40 bg-red-500/5' : 'bg-obsidian-900/50 border-obsidian-700'}`}>
            <p className="text-sm text-platinum-400">Left to spend</p>
            <p className={`text-lg sm:text-xl font-semibold tabular-nums ${totalBudget && summary.spent > totalBudget ? 'text-red-400' : 'text-white'}`}>
              {totalBudget ? formatMoney(totalBudget - summary.spent, currency) : '–'}
            </p>
          </div>
        </div>
        {unbudgeted > 0 && totalBudget > 0 && (
          <p className="text-sm text-platinum-500 mb-2">Includes {formatMoney(unbudgeted, currency)} spent in categories without a budget.</p>
        )}

        <ul className="mt-4">
          {sorted.map((cat) => (
            <BudgetRow key={cat.id} cat={cat} spent={summary.byCategory[cat.name] || 0} currency={currency} onSave={save} onClear={clear} paceDays={paceDays} />
          ))}
        </ul>

        <form onSubmit={addCategory} className="mt-4 flex gap-2">
          <input className="input" placeholder="Add a category, e.g. Kids or Pets" value={newCat} onChange={(e) => setNewCat(e.target.value)} maxLength={40} aria-label="New category name" />
          <button type="submit" className="btn-ghost shrink-0" disabled={!newCat.trim()}><Plus size={16} /> Add</button>
        </form>
      </div>

      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Start with 50/30/20"
        subtitle="50% for needs, 30% for wants, 20% for saving and debt. Adjust anything before applying."
        size="lg"
        footer={<>
          <button className="btn-ghost" onClick={() => setTemplateOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={applyTemplate} disabled={busy || !proposal.length}>{busy && <Loader2 size={16} className="animate-spin" />}Apply budgets</button>
        </>}
      >
        <label className="label" htmlFor="tpl-income">Monthly take-home pay ({currency})</label>
        <div className="flex gap-2 mb-2">
          <input id="tpl-income" className="input" type="number" inputMode="decimal" min="0" value={templateIncome} onChange={(e) => setTemplateIncome(e.target.value)} />
          <button className="btn-secondary shrink-0" onClick={() => setProposal(buildProposal(parseFloat(templateIncome) || 0))} disabled={!(parseFloat(templateIncome) > 0)}>Calculate</button>
        </div>
        {proposal.length > 0 && (
          <>
            <p className="hint mb-4">About {formatMoney((parseFloat(templateIncome) || 0) * TEMPLATE_SAVINGS_SHARE, currency)} a month is left for your goals. Bills you’ve already added are covered in full.</p>
            <ul className="divide-y divide-obsidian-700/60">
              {proposal.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-platinum-200">{p.name}</span>
                  <input
                    className="input !w-36 !py-2 text-right"
                    type="number"
                    min="0"
                    value={p.budget}
                    onChange={(e) => setProposal((prev) => prev.map((x, j) => (j === i ? { ...x, budget: Math.max(0, parseFloat(e.target.value) || 0) } : x)))}
                    aria-label={`${p.name} budget`}
                  />
                </li>
              ))}
            </ul>
            <p className="text-sm text-platinum-400 mt-3">Total: <span className="text-white font-semibold">{formatMoney(proposal.reduce((s, p) => s + p.budget, 0), currency)}</span> a month.</p>
          </>
        )}
      </Modal>
    </div>
  );
};

export default BudgetsTab;
