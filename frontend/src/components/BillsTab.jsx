import React, { useMemo } from 'react';
import { Plus, CalendarDays, Repeat } from 'lucide-react';
import CategoryIcon from './ui/CategoryIcon';
import { activeBills } from '../lib/insights';
import { entriesForMonth, isRecurringItem, sumAmounts } from '../lib/recurring';
import { formatMoney, monthLabel, daysInMonth, ordinal, formatDate, toISODate } from '../lib/format';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const BillsTab = ({ data, year, month, currency, onAddBill, onEditExpense }) => {
  const bills = useMemo(() => activeBills(data.expenses), [data.expenses]);
  const monthBills = useMemo(
    () => entriesForMonth(data.expenses.filter(isRecurringItem), year, month),
    [data.expenses, year, month]
  );
  const monthlyTotal = sumAmounts(monthBills);
  const subs = bills.filter((b) => b.category === 'Subscriptions');
  const upcoming = bills.filter((b) => b.daysUntil <= 30);

  // Calendar grid for the viewed month (weeks start Monday)
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const dim = daysInMonth(year, month);
  const byDay = {};
  monthBills.forEach((b) => {
    const d = Number(b.displayDate.slice(8, 10));
    (byDay[d] = byDay[d] || []).push(b);
  });
  const today = new Date();
  const todayKey = toISODate(today);

  const whenText = (d) => (d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h2 className="card-title">Bills & subscriptions</h2>
            <p className="text-platinum-400 mt-1">Everything that repeats each month, and when it leaves your account.</p>
          </div>
          <button className="btn-primary shrink-0" onClick={onAddBill}><Plus size={16} /> Add a bill</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          <div className="rounded-xl bg-obsidian-900/50 border border-obsidian-700 p-4">
            <p className="text-sm text-platinum-400">Fixed costs in {monthLabel(year, month)}</p>
            <p className="text-xl font-semibold text-white tabular-nums">{formatMoney(monthlyTotal, currency)}</p>
            <p className="text-sm text-platinum-500">{monthBills.length} bill{monthBills.length === 1 ? '' : 's'}</p>
          </div>
          <div className="rounded-xl bg-obsidian-900/50 border border-obsidian-700 p-4">
            <p className="text-sm text-platinum-400">Subscriptions</p>
            <p className="text-xl font-semibold text-white tabular-nums">{formatMoney(sumAmounts(subs), currency)}<span className="text-sm font-normal text-platinum-500"> /month</span></p>
            <p className="text-sm text-platinum-500">{subs.length ? `${subs.length} active, ${formatMoney(sumAmounts(subs) * 12, currency)} a year` : 'None tracked'}</p>
          </div>
          <div className="rounded-xl bg-obsidian-900/50 border border-obsidian-700 p-4">
            <p className="text-sm text-platinum-400">Next up</p>
            {upcoming[0] ? (
              <>
                <p className="text-xl font-semibold text-white truncate">{upcoming[0].name}</p>
                <p className="text-sm text-platinum-500">{whenText(upcoming[0].daysUntil)} · {formatMoney(upcoming[0].amount, currency)}</p>
              </>
            ) : <p className="text-platinum-500 mt-1">Nothing due</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-3">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4"><CalendarDays size={18} className="text-gold-500" /> {monthLabel(year, month)}</h3>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-platinum-500 mb-1">
            {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${i}`} />)}
            {Array.from({ length: dim }, (_, i) => i + 1).map((d) => {
              const items = byDay[d] || [];
              const iso = toISODate(new Date(year, month, d));
              const isToday = iso === todayKey;
              const total = sumAmounts(items);
              return (
                <div
                  key={d}
                  className={`min-h-[56px] sm:min-h-[72px] rounded-lg border p-1 sm:p-1.5 text-left ${items.length ? 'border-gold-500/40 bg-gold-500/5' : 'border-obsidian-700/60'} ${isToday ? 'ring-2 ring-gold-500/60' : ''}`}
                  title={items.map((b) => `${b.name}: ${formatMoney(b.amount, currency)}`).join('\n')}
                >
                  <div className={`text-xs ${isToday ? 'text-gold-500 font-bold' : 'text-platinum-400'}`}>{d}</div>
                  {items.length > 0 && (
                    <>
                      <div className="hidden sm:block text-[11px] leading-tight text-platinum-200 truncate mt-0.5">{items[0].name}{items.length > 1 ? ` +${items.length - 1}` : ''}</div>
                      <div className="text-[11px] leading-tight text-gold-500 font-semibold tabular-nums truncate">{formatMoney(total, currency).replace(/\.00$/, '')}</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-4">All bills</h3>
          {bills.length === 0 ? (
            <div className="text-center py-10">
              <Repeat size={32} className="mx-auto mb-3 text-gold-500/40" />
              <p className="text-platinum-300">No repeating bills yet</p>
              <p className="text-sm text-platinum-500 mt-1 mb-4">Add rent, phone, streaming and so on once. They’ll fill in every month.</p>
              <button className="btn-secondary" onClick={onAddBill}><Plus size={16} /> Add a bill</button>
            </div>
          ) : (
            <ul className="space-y-2">
              {bills.map((b) => (
                <li key={b.id}>
                  <button className="row-item w-full text-left !p-3" onClick={() => onEditExpense(b)}>
                    <CategoryIcon name={b.category} categories={data.categories} size={16} className="!p-2" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-platinum-100 truncate">{b.name}</p>
                      <p className="text-sm text-platinum-500">
                        {ordinal(b.dueDay)} of each month · {b.daysUntil <= 7 ? <span className="text-gold-500">{whenText(b.daysUntil)}</span> : formatDate(toISODate(b.nextDue))}
                      </p>
                    </div>
                    <span className="font-semibold text-white tabular-nums">{formatMoney(b.amount, currency)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillsTab;
