import React, { useMemo } from 'react';
import { ArrowRight, CheckCircle2, Circle, Rocket, Repeat } from 'lucide-react';
import CategoryIcon from './ui/CategoryIcon';
import TrendsCard from './TrendsCard';
import RechartsSpendingChart from './RechartsSpendingChart';
import { activeBills } from '../lib/insights';
import { formatMoney, formatDate } from '../lib/format';

const GettingStarted = ({ data, onStartSetup, setActiveTab, onAddExpense }) => {
  const steps = [
    { done: data.income.length > 0, label: 'Add your income', action: () => setActiveTab('income') },
    { done: data.expenses.some((e) => e.isRecurring), label: 'Add your monthly bills', action: () => setActiveTab('bills') },
    { done: data.expenseCategories.some((c) => Number(c.budget) > 0), label: 'Set your budgets', action: () => setActiveTab('budgets') },
    { done: data.expenses.some((e) => !e.isRecurring), label: 'Record something you spent', action: () => onAddExpense() },
    { done: data.goals.length > 0, label: 'Create a savings goal', action: () => setActiveTab('goals') },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <div className="card border-gold-gradient">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="card-title flex items-center gap-2"><Rocket size={22} className="text-gold-500" /> Get set up</h2>
          <p className="text-platinum-400 mt-1">{doneCount} of {steps.length} done. A couple of minutes now makes everything else work.</p>
        </div>
        <button className="btn-primary shrink-0" onClick={onStartSetup}>Guided setup</button>
      </div>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {steps.map((s) => (
          <li key={s.label}>
            <button onClick={s.action} disabled={s.done} className={`w-full flex items-center gap-2 rounded-xl border px-3 py-3 text-sm text-left transition-colors ${s.done ? 'border-emerald-500/30 text-platinum-400' : 'border-obsidian-600 text-platinum-200 hover:border-gold-500/60'}`}>
              {s.done ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> : <Circle size={18} className="text-platinum-500 shrink-0" />}
              <span className={s.done ? 'line-through' : ''}>{s.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const OverviewTab = ({ data, summary, year, month, currency, setActiveTab, onAddExpense, onEditExpense, onStartSetup }) => {
  const budgeted = data.expenseCategories
    .filter((c) => Number(c.budget) > 0)
    .map((c) => ({ ...c, spent: summary.byCategory[c.name] || 0 }))
    .sort((a, b) => b.spent / b.budget - a.spent / a.budget)
    .slice(0, 6);
  const upcoming = useMemo(() => activeBills(data.expenses).filter((b) => b.daysUntil <= 14).slice(0, 4), [data.expenses]);
  const recent = summary.expenses.slice(0, 6);

  return (
    <div className="space-y-6">
      <GettingStarted data={data} onStartSetup={onStartSetup} setActiveTab={setActiveTab} onAddExpense={onAddExpense} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <h2 className="card-title">Budgets</h2>
              <button onClick={() => setActiveTab('budgets')} className="text-sm font-medium text-gold-500 hover:text-gold-400 flex items-center gap-1">Manage <ArrowRight size={16} /></button>
            </div>
            {budgeted.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-platinum-300">You haven’t set any budgets yet.</p>
                <button onClick={() => setActiveTab('budgets')} className="btn-secondary mt-4">Set budgets</button>
              </div>
            ) : (
              <ul className="space-y-5">
                {budgeted.map((c) => {
                  const pct = (c.spent / c.budget) * 100;
                  const over = pct > 100;
                  const warn = !over && pct >= 85;
                  return (
                    <li key={c.id}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="flex items-center gap-3 min-w-0">
                          <CategoryIcon iconKey={c.icon} size={16} className="!p-2" />
                          <span className="min-w-0">
                            <span className="block font-medium text-platinum-100 truncate">{c.name}</span>
                            <span className={`block text-sm ${over ? 'text-red-400' : warn ? 'text-gold-500' : 'text-platinum-500'}`}>
                              {over ? `${formatMoney(c.spent - c.budget, currency)} over` : `${formatMoney(c.budget - c.spent, currency)} left`}
                            </span>
                          </span>
                        </span>
                        <span className="text-sm text-platinum-400 tabular-nums whitespace-nowrap"><span className="text-white font-semibold">{formatMoney(c.spent, currency)}</span> / {formatMoney(c.budget, currency)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-obsidian-900 overflow-hidden">
                        <div className={`h-full rounded-full ${over ? 'bg-red-500' : warn ? 'bg-gold-400' : 'bg-gold-gradient'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <TrendsCard data={data} year={year} month={month} currency={currency} />
          <RechartsSpendingChart byCategory={summary.byCategory} categories={data.expenseCategories} currency={currency} />
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title">Coming up</h2>
              <button onClick={() => setActiveTab('bills')} className="text-sm font-medium text-gold-500 hover:text-gold-400 flex items-center gap-1">All bills <ArrowRight size={16} /></button>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-platinum-500 text-sm">No bills due in the next two weeks.</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((b) => (
                  <li key={b.id} className="flex items-center gap-3">
                    <CategoryIcon name={b.category} categories={data.categories} size={16} className="!p-2" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-platinum-100 truncate">{b.name}</p>
                      <p className="text-sm text-platinum-500">{b.daysUntil === 0 ? 'Today' : b.daysUntil === 1 ? 'Tomorrow' : `In ${b.daysUntil} days`}</p>
                    </div>
                    <span className="font-semibold text-white tabular-nums">{formatMoney(b.amount, currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title">Recent</h2>
              <button onClick={() => setActiveTab('expenses')} className="text-sm font-medium text-gold-500 hover:text-gold-400 flex items-center gap-1">See all <ArrowRight size={16} /></button>
            </div>
            {recent.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-platinum-500 text-sm mb-4">Nothing recorded this month.</p>
                <button className="btn-secondary" onClick={() => onAddExpense()}>Add an expense</button>
              </div>
            ) : (
              <ul className="space-y-1">
                {recent.map((e) => (
                  <li key={`${e.id}-${e.displayDate}`}>
                    <button onClick={() => onEditExpense(e)} className="w-full flex items-center gap-3 rounded-xl p-2 -mx-2 text-left hover:bg-obsidian-700/40">
                      <CategoryIcon name={e.category} categories={data.categories} size={16} className="!p-2" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-platinum-100 truncate flex items-center gap-1.5">{e.name}{e.isRecurring && <Repeat size={12} className="text-gold-500 shrink-0" />}</p>
                        <p className="text-sm text-platinum-500">{e.category} · {formatDate(e.displayDate)}</p>
                      </div>
                      <span className="font-semibold text-white tabular-nums">{formatMoney(e.amount, currency)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
