import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Repeat, Briefcase, Loader2 } from 'lucide-react';
import Modal from './ui/Modal';
import CategoryIcon from './ui/CategoryIcon';
import { entriesForMonth, sumAmounts, endOfPreviousMonth } from '../lib/recurring';
import { formatMoney, formatDate, monthLabel, defaultDateForMonth, MONTHS } from '../lib/format';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';

const IncomeModal = ({ open, onClose, income, categories, currency, defaultDate, onAdd, onUpdate }) => {
  const { toast } = useToast();
  const isEdit = Boolean(income);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(isEdit
      ? { source: income.source, amount: String(income.amount), category: income.category, occurred_on: income.occurred_on, is_recurring: income.is_recurring }
      : { source: '', amount: '', category: categories[0]?.name || 'Salary', occurred_on: defaultDate, is_recurring: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.source?.trim() || !(amount > 0)) {
      toast({ tone: 'error', message: 'Add where it came from and an amount above zero.' });
      return;
    }
    setBusy(true);
    const ok = isEdit
      ? await onUpdate(income.id, { source: form.source.trim(), amount, category: form.category, occurred_on: form.occurred_on, is_recurring: form.is_recurring })
      : await onAdd({ ...form, amount });
    setBusy(false);
    if (ok) {
      toast({ message: isEdit ? 'Changes saved' : 'Income added' });
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit income' : 'Add income'}
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}{isEdit ? 'Save changes' : 'Add income'}</button>
      </>}
    >
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label" htmlFor="inc-source">Where’s it from?</label>
          <input id="inc-source" className="input" value={form.source || ''} onChange={(e) => set({ source: e.target.value })} placeholder="e.g. Salary from Acme" autoFocus required maxLength={120} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="inc-amount">Amount ({currency})</label>
            <input id="inc-amount" className="input" type="number" inputMode="decimal" min="0.01" step="0.01" value={form.amount || ''} onChange={(e) => set({ amount: e.target.value })} placeholder="0.00" required />
          </div>
          <div>
            <label className="label" htmlFor="inc-date">{form.is_recurring ? 'First payday' : 'Date received'}</label>
            <input id="inc-date" className="input" type="date" value={form.occurred_on || ''} onChange={(e) => set({ occurred_on: e.target.value })} required />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="inc-cat">Type</label>
          <select id="inc-cat" className="input" value={form.category || ''} onChange={(e) => set({ category: e.target.value })}>
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-obsidian-700 p-3 hover:border-gold-500/40">
          <input type="checkbox" className="mt-0.5 w-5 h-5 accent-gold-500" checked={Boolean(form.is_recurring)} onChange={(e) => set({ is_recurring: e.target.checked })} />
          <span>
            <span className="block text-sm font-medium text-platinum-200">I get this every month</span>
            <span className="block text-sm text-platinum-500">Like a salary. It’ll be added to each month automatically, so you only enter it once.</span>
          </span>
        </label>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
};

const IncomeTab = ({ data, year, month, currency }) => {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [modal, setModal] = useState({ open: false, income: null });

  const entries = useMemo(() => entriesForMonth(data.income, year, month), [data.income, year, month]);
  const total = sumAmounts(entries);

  const handleDelete = async (inc) => {
    if (inc.is_recurring && inc.isOccurrence) {
      const choice = await confirm({
        title: `Delete “${inc.source}”?`,
        message: `This repeats every month. Stop it from ${MONTHS[month]} onward and keep earlier months, or remove it everywhere?`,
        choices: [
          { value: 'stop', label: `Stop from ${MONTHS[month]}`, tone: 'secondary' },
          { value: 'all', label: 'Delete from all months', tone: 'danger' },
        ],
      });
      if (choice === 'stop') {
        const ok = await data.updateIncome(inc.id, { recurring_end: endOfPreviousMonth(year, month) });
        if (ok) toast({ message: `“${inc.source}” won’t appear from ${MONTHS[month]} onward` });
      } else if (choice === 'all') data.deleteIncome(inc);
      return;
    }
    data.deleteIncome(inc);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="card-title">Income</h2>
            <p className="text-platinum-400 mt-1">{monthLabel(year, month)} · <span className="text-white font-semibold">{formatMoney(total, currency)}</span></p>
          </div>
          <button className="btn-primary" onClick={() => setModal({ open: true, income: null })}><Plus size={16} /> Add income</button>
        </div>

        <ul className="space-y-2">
          {entries.map((inc) => (
            <li key={`${inc.id}-${inc.displayDate}`}>
              <div className="row-item cursor-pointer" onClick={() => setModal({ open: true, income: inc })} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setModal({ open: true, income: inc })}>
                <CategoryIcon name={inc.category} categories={data.incomeCategories} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-platinum-100 truncate">{inc.source}</p>
                    {inc.is_recurring && <span className="badge bg-gold-500/10 text-gold-500"><Repeat size={12} /> Monthly</span>}
                  </div>
                  <p className="text-sm text-platinum-500 mt-0.5">{inc.category} · {formatDate(inc.displayDate)}</p>
                </div>
                <span className="font-semibold text-emerald-500 tabular-nums whitespace-nowrap">+{formatMoney(inc.amount, currency)}</span>
                <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn hidden sm:inline-flex" onClick={() => setModal({ open: true, income: inc })} aria-label={`Edit ${inc.source}`}><Pencil size={16} /></button>
                  <button className="icon-btn hover:!text-red-400 hover:!bg-red-500/10" onClick={() => handleDelete(inc)} aria-label={`Delete ${inc.source}`}><Trash2 size={16} /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {entries.length === 0 && (
          <div className="text-center py-14 border border-dashed border-obsidian-700 rounded-2xl">
            <Briefcase size={36} className="mx-auto mb-3 text-gold-500/40" />
            <p className="text-platinum-300 font-medium">No income for {monthLabel(year, month)}</p>
            <p className="text-sm text-platinum-500 mt-1 mb-4">Add your salary once and tick “every month”. It’ll carry forward automatically.</p>
            <button className="btn-primary" onClick={() => setModal({ open: true, income: null })}><Plus size={16} /> Add income</button>
          </div>
        )}
      </div>

      <IncomeModal
        open={modal.open}
        income={modal.income}
        onClose={() => setModal({ open: false, income: null })}
        categories={data.incomeCategories}
        currency={currency}
        defaultDate={defaultDateForMonth(year, month)}
        onAdd={data.addIncome}
        onUpdate={data.updateIncome}
      />
    </div>
  );
};

export default IncomeTab;
