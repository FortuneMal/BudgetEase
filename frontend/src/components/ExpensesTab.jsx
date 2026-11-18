import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Repeat, Upload, Download, Receipt, Search } from 'lucide-react';
import CategoryIcon from './ui/CategoryIcon';
import ReceiptButton from './ui/ReceiptButton';
import { entriesForMonth, sumAmounts, endOfPreviousMonth } from '../lib/recurring';
import { formatMoney, formatDate, monthLabel, MONTHS } from '../lib/format';
import { exportMonthCSV } from '../lib/report';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';

const ExpensesTab = ({ data, year, month, currency, onAddExpense, onEditExpense, onImport }) => {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [filterCategory, setFilterCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');

  const monthEntries = useMemo(() => entriesForMonth(data.expenses, year, month), [data.expenses, year, month]);
  const total = sumAmounts(monthEntries);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monthEntries
      .filter((e) => filterCategory === 'All' || e.category === filterCategory)
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q))
      .sort((a, b) => (sortBy === 'amount' ? b.amount - a.amount : a.displayDate < b.displayDate ? 1 : -1));
  }, [monthEntries, filterCategory, search, sortBy]);

  const usedCategories = [...new Set(monthEntries.map((e) => e.category))];
  const filterOptions = [...new Set([...data.expenseCategories.map((c) => c.name), ...usedCategories])];

  const handleDelete = async (exp) => {
    if (exp.isRecurring && exp.isOccurrence) {
      const choice = await confirm({
        title: `Delete “${exp.name}”?`,
        message: `This repeats every month. You can stop it from ${MONTHS[month]} onward and keep earlier months, or remove it from every month.`,
        choices: [
          { value: 'stop', label: `Stop from ${MONTHS[month]}`, tone: 'secondary' },
          { value: 'all', label: 'Delete from all months', tone: 'danger' },
        ],
      });
      if (choice === 'stop') {
        const ok = await data.updateExpense(exp.id, { recurring_end: endOfPreviousMonth(year, month) });
        if (ok) toast({ message: `“${exp.name}” won’t appear from ${MONTHS[month]} onward` });
      } else if (choice === 'all') {
        data.deleteExpense(exp);
      }
      return;
    }
    data.deleteExpense(exp);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="card-title">Spending</h2>
            <p className="text-platinum-400 mt-1">
              {monthLabel(year, month)} · <span className="text-white font-semibold">{formatMoney(total, currency)}</span> across {monthEntries.length} {monthEntries.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost !px-4" onClick={onImport}><Upload size={16} /> Import statement</button>
            <button className="btn-ghost !px-4" onClick={() => exportMonthCSV(data, year, month)} disabled={!monthEntries.length}><Download size={16} /> Export</button>
            <button className="btn-primary" onClick={() => onAddExpense()}><Plus size={16} /> Add expense</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-platinum-500" />
            <input className="input !pl-10" placeholder="Search spending" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search spending" />
          </div>
          <select className="input sm:w-48" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} aria-label="Filter by category">
            <option value="All">All categories</option>
            {filterOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input sm:w-40" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort">
            <option value="date">Newest first</option>
            <option value="amount">Largest first</option>
          </select>
        </div>

        <ul className="space-y-2">
          {visible.map((exp) => (
            <li key={`${exp.id}-${exp.displayDate}`}>
              <div
                className="row-item cursor-pointer"
                onClick={() => onEditExpense(exp)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onEditExpense(exp)}
              >
                <CategoryIcon name={exp.category} categories={data.categories} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-platinum-100 truncate">{exp.name}</p>
                    {exp.isRecurring && <span className="badge bg-gold-500/10 text-gold-500"><Repeat size={12} /> Monthly</span>}
                  </div>
                  <p className="text-sm text-platinum-500 mt-0.5">{exp.category} · {formatDate(exp.displayDate)}</p>
                </div>
                <span className="font-semibold text-white tabular-nums whitespace-nowrap">{formatMoney(exp.amount, currency)}</span>
                <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                  <ReceiptButton path={exp.receipt_path} />
                  <button className="icon-btn hidden sm:inline-flex" onClick={() => onEditExpense(exp)} aria-label={`Edit ${exp.name}`}><Pencil size={16} /></button>
                  <button className="icon-btn hover:!text-red-400 hover:!bg-red-500/10" onClick={() => handleDelete(exp)} aria-label={`Delete ${exp.name}`}><Trash2 size={16} /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {visible.length === 0 && (
          <div className="text-center py-14 border border-dashed border-obsidian-700 rounded-2xl">
            <Receipt size={36} className="mx-auto mb-3 text-gold-500/40" />
            {monthEntries.length === 0 ? (
              <>
                <p className="text-platinum-300 font-medium">Nothing spent in {monthLabel(year, month)} yet</p>
                <p className="text-sm text-platinum-500 mt-1 mb-4">Add your first expense, or import a bank statement to catch up fast.</p>
                <div className="flex justify-center gap-2">
                  <button className="btn-primary" onClick={() => onAddExpense()}><Plus size={16} /> Add expense</button>
                  <button className="btn-ghost" onClick={onImport}><Upload size={16} /> Import</button>
                </div>
              </>
            ) : (
              <p className="text-platinum-400">No matches. Try a different search or category.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpensesTab;
