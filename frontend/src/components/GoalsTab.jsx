import React, { useMemo, useState } from 'react';
import { Plus, Minus, Target, Trash2, Pencil, Trophy, CalendarClock, ChevronDown, Loader2 } from 'lucide-react';
import Modal from './ui/Modal';
import { goalProgress, monthSummary } from '../lib/insights';
import { formatMoney, formatDate, formatDateLong, monthLabel, todayISO, parseISODate } from '../lib/format';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';

const STATUS = {
  'on-track': { label: 'On track', cls: 'bg-emerald-500/10 text-emerald-500' },
  behind: { label: 'Behind', cls: 'bg-gold-500/10 text-gold-500' },
  overdue: { label: 'Past target date', cls: 'bg-red-500/10 text-red-400' },
  done: { label: 'Reached', cls: 'bg-emerald-500/10 text-emerald-500' },
  open: { label: 'No deadline', cls: 'bg-obsidian-700 text-platinum-400' },
};

const GoalModal = ({ open, onClose, goal, currency, onSave }) => {
  const isEdit = Boolean(goal);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (open) setForm(isEdit
      ? { name: goal.name, target: String(goal.target), target_date: goal.target_date || '', starting: '' }
      : { name: '', target: '', target_date: '', starting: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onSave(form);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit goal' : 'New savings goal'}
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy || !form.name?.trim() || !(parseFloat(form.target) > 0)}>
          {busy && <Loader2 size={16} className="animate-spin" />}{isEdit ? 'Save changes' : 'Create goal'}
        </button>
      </>}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="goal-name">What are you saving for?</label>
          <input id="goal-name" className="input" value={form.name || ''} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Holiday in Cape Town" autoFocus maxLength={80} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="goal-target">Target ({currency})</label>
            <input id="goal-target" className="input" type="number" inputMode="decimal" min="1" value={form.target || ''} onChange={(e) => set({ target: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="goal-date">By when? <span className="text-platinum-500">(optional)</span></label>
            <input id="goal-date" className="input" type="date" min={todayISO()} value={form.target_date || ''} onChange={(e) => set({ target_date: e.target.value })} />
          </div>
        </div>
        {!isEdit && (
          <div>
            <label className="label" htmlFor="goal-start">Already saved <span className="text-platinum-500">(optional)</span></label>
            <input id="goal-start" className="input" type="number" inputMode="decimal" min="0" value={form.starting || ''} onChange={(e) => set({ starting: e.target.value })} placeholder="0.00" />
          </div>
        )}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
};

const MoneyModal = ({ open, onClose, goal, direction, currency, saved, onSave }) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  React.useEffect(() => { if (open) { setAmount(''); setDate(todayISO()); } }, [open]);
  const isOut = direction === 'out';
  const n = parseFloat(amount);
  const invalid = !(n > 0) || (isOut && n > saved + 0.001);

  const submit = async (e) => {
    e.preventDefault();
    if (invalid) return;
    setBusy(true);
    const ok = await onSave({ goal_id: goal.id, amount: isOut ? -n : n, occurred_on: date });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="sm" title={isOut ? `Take money out of ${goal?.name}` : `Add money to ${goal?.name}`}
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy || invalid}>{busy && <Loader2 size={16} className="animate-spin" />}{isOut ? 'Take out' : 'Add money'}</button>
      </>}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="money-amt">Amount ({currency})</label>
          <input id="money-amt" className="input" type="number" inputMode="decimal" min="0.01" step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
          {isOut && <p className="hint">Up to {formatMoney(saved, currency)} available.</p>}
        </div>
        <div>
          <label className="label" htmlFor="money-date">Date</label>
          <input id="money-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
};

const GoalsTab = ({ data, year, month, currency }) => {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [goalModal, setGoalModal] = useState({ open: false, goal: null });
  const [moneyModal, setMoneyModal] = useState({ open: false, goal: null, direction: 'in' });
  const [expanded, setExpanded] = useState(null);

  const summary = useMemo(() => monthSummary(data, year, month), [data, year, month]);
  const putAsideThisMonth = data.goal_contributions
    .filter((c) => { const d = parseISODate(c.occurred_on); return d.getFullYear() === year && d.getMonth() === month; })
    .reduce((s, c) => s + Number(c.amount), 0);
  const unallocated = summary.earned - summary.spent - putAsideThisMonth;

  const saveGoal = async (form) => {
    const patch = { name: form.name.trim(), target: parseFloat(form.target), target_date: form.target_date || null };
    if (goalModal.goal) {
      const ok = await data.updateGoal(goalModal.goal.id, patch);
      if (ok) toast({ message: 'Goal updated' });
      return ok;
    }
    const saved = await data.addGoal(patch);
    if (!saved) return false;
    const start = parseFloat(form.starting);
    if (start > 0) await data.addContribution({ goal_id: saved.id, amount: start, note: 'Starting balance' });
    toast({ message: `Goal “${patch.name}” created` });
    return true;
  };

  const removeGoal = async (goal, saved) => {
    const ok = await confirm({
      title: `Delete “${goal.name}”?`,
      message: saved > 0
        ? `This removes the goal and its history of ${formatMoney(saved, currency)} saved. It doesn’t move any real money.`
        : 'This removes the goal.',
      confirmLabel: 'Delete goal',
      tone: 'danger',
    });
    if (ok && (await data.deleteGoal(goal))) toast({ message: 'Goal deleted' });
  };

  const addMoney = async (c) => {
    const saved = await data.addContribution(c);
    if (saved) toast({ message: c.amount > 0 ? `Added ${formatMoney(c.amount, currency)}` : `Took out ${formatMoney(-c.amount, currency)}` });
    return Boolean(saved);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h2 className="card-title">Savings goals</h2>
            <p className="text-platinum-400 mt-1">Put money towards each goal and see exactly what it takes to get there.</p>
          </div>
          <button className="btn-primary shrink-0" onClick={() => setGoalModal({ open: true, goal: null })}><Plus size={16} /> New goal</button>
        </div>
        {(summary.earned > 0 || putAsideThisMonth > 0) && (
          <div className="mt-5 rounded-xl border border-obsidian-700 bg-obsidian-900/50 p-4 text-sm text-platinum-300">
            In {monthLabel(year, month)} you’ve put <span className="text-white font-semibold">{formatMoney(putAsideThisMonth, currency)}</span> into goals.{' '}
            {unallocated > 0
              ? <>There’s <span className="text-emerald-500 font-semibold">{formatMoney(unallocated, currency)}</span> left over that isn’t assigned to anything yet.</>
              : unallocated < 0
                ? <>You’ve spent and saved {formatMoney(-unallocated, currency)} more than you earned this month.</>
                : null}
          </div>
        )}
      </div>

      {data.goals.length === 0 && (
        <div className="card text-center py-14">
          <Target size={40} className="mx-auto mb-3 text-gold-500/40" />
          <p className="text-platinum-200 font-medium">No goals yet</p>
          <p className="text-sm text-platinum-500 mt-1 mb-5 max-w-sm mx-auto">An emergency fund of three months’ expenses is a great first goal.</p>
          <button className="btn-primary" onClick={() => setGoalModal({ open: true, goal: null })}><Plus size={16} /> Create a goal</button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data.goals.map((goal) => {
          const p = goalProgress(goal, data.goal_contributions);
          const st = STATUS[p.status];
          const isOpen = expanded === goal.id;
          return (
            <div key={goal.id} className="card !p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-obsidian-900 border border-obsidian-700 text-gold-500">{p.status === 'done' ? <Trophy size={20} /> : <Target size={20} />}</div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-lg text-white truncate">{goal.name}</h3>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                  </div>
                </div>
                <div className="flex">
                  <button className="icon-btn" onClick={() => setGoalModal({ open: true, goal })} aria-label={`Edit ${goal.name}`}><Pencil size={16} /></button>
                  <button className="icon-btn hover:!text-red-400" onClick={() => removeGoal(goal, p.saved)} aria-label={`Delete ${goal.name}`}><Trash2 size={16} /></button>
                </div>
              </div>

              <div className="mt-5 flex items-baseline justify-between">
                <span className="text-2xl font-semibold text-white tabular-nums">{formatMoney(p.saved, currency)}</span>
                <span className="text-platinum-400">of {formatMoney(p.target, currency)}</span>
              </div>
              <div className="mt-2 h-2.5 rounded-full bg-obsidian-900 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${p.status === 'done' ? 'bg-emerald-500' : 'bg-gold-gradient'}`} style={{ width: `${p.pct}%` }} />
              </div>
              <p className="text-sm text-platinum-400 mt-2">{Math.round(p.pct)}% saved{p.remaining > 0 ? ` · ${formatMoney(p.remaining, currency)} to go` : ''}</p>

              {goal.target_date && p.remaining > 0 && (
                <p className="mt-3 flex items-start gap-2 text-sm text-platinum-200">
                  <CalendarClock size={16} className="text-gold-500 mt-0.5 shrink-0" />
                  {p.status === 'overdue'
                    ? <>The target date ({formatDateLong(goal.target_date)}) has passed. Pick a new date to get a monthly amount.</>
                    : <>Save <strong className="text-white">{formatMoney(p.perMonth, currency)}</strong> a month to reach it by {formatDate(goal.target_date, { month: 'long', year: 'numeric' })}.</>}
                </p>
              )}

              <div className="mt-5 flex gap-2">
                <button className="btn-primary flex-1 !py-2.5" onClick={() => setMoneyModal({ open: true, goal, direction: 'in' })}><Plus size={16} /> Add money</button>
                <button className="btn-ghost !py-2.5" onClick={() => setMoneyModal({ open: true, goal, direction: 'out' })} disabled={p.saved <= 0}><Minus size={16} /> Take out</button>
              </div>

              {p.entries.length > 0 && (
                <div className="mt-4 border-t border-obsidian-700 pt-3">
                  <button className="text-sm text-platinum-400 hover:text-platinum-200 flex items-center gap-1" onClick={() => setExpanded(isOpen ? null : goal.id)} aria-expanded={isOpen}>
                    <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} /> History ({p.entries.length})
                  </button>
                  {isOpen && (
                    <ul className="mt-2 space-y-1">
                      {[...p.entries].sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : -1)).map((c) => (
                        <li key={c.id} className="flex items-center justify-between text-sm py-1">
                          <span className="text-platinum-400">{formatDate(c.occurred_on, { day: 'numeric', month: 'short', year: 'numeric' })}{c.note ? ` · ${c.note}` : ''}</span>
                          <span className="flex items-center gap-1">
                            <span className={`tabular-nums ${c.amount < 0 ? 'text-red-400' : 'text-emerald-500'}`}>{formatMoney(c.amount, currency, { signed: true })}</span>
                            <button className="icon-btn !p-1" onClick={() => data.deleteContribution(c)} aria-label="Remove entry"><Trash2 size={14} /></button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <GoalModal open={goalModal.open} goal={goalModal.goal} currency={currency} onClose={() => setGoalModal({ open: false, goal: null })} onSave={saveGoal} />
      <MoneyModal
        open={moneyModal.open}
        goal={moneyModal.goal}
        direction={moneyModal.direction}
        currency={currency}
        saved={moneyModal.goal ? goalProgress(moneyModal.goal, data.goal_contributions).saved : 0}
        onClose={() => setMoneyModal({ open: false, goal: null, direction: 'in' })}
        onSave={addMoney}
      />
    </div>
  );
};

export default GoalsTab;
