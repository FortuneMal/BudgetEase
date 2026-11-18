import React from 'react';
import ReceiptButton from './ui/ReceiptButton';

/**
 * Controlled fields for an expense. `value` = { name, amount, category, occurred_on, isRecurring, receipt_path }.
 */
const ExpenseFields = ({ value, onChange, categories, currency, autoFocus = false, isExisting = false }) => {
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="exp-name">What was it for?</label>
        <input
          id="exp-name"
          className="input"
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g. Groceries at Checkers"
          autoFocus={autoFocus}
          required
          maxLength={120}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="exp-amount">Amount ({currency})</label>
          <input
            id="exp-amount"
            className="input"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={value.amount}
            onChange={(e) => set({ amount: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="exp-date">{value.isRecurring ? 'First payment' : 'Date'}</label>
          <input
            id="exp-date"
            className="input"
            type="date"
            value={value.occurred_on}
            onChange={(e) => set({ occurred_on: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="exp-category">Category</label>
        <select id="exp-category" className="input" value={value.category} onChange={(e) => set({ category: e.target.value })}>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          {value.category && !categories.some((c) => c.name === value.category) && (
            <option value={value.category}>{value.category}</option>
          )}
        </select>
      </div>

      <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-obsidian-700 p-3 hover:border-gold-500/40">
        <input
          type="checkbox"
          checked={value.isRecurring}
          onChange={(e) => set({ isRecurring: e.target.checked })}
          className="mt-0.5 w-5 h-5 accent-gold-500"
        />
        <span>
          <span className="block text-sm font-medium text-platinum-200">Repeats every month</span>
          <span className="block text-sm text-platinum-500">
            For rent, subscriptions and other bills. {isExisting && value.isRecurring ? 'Changes apply to every month.' : 'It will show up in each month automatically.'}
          </span>
        </span>
      </label>

      {value.receipt_path && (
        <div className="flex items-center justify-between rounded-xl border border-obsidian-700 p-3">
          <span className="text-sm text-platinum-300">Receipt attached</span>
          <ReceiptButton path={value.receipt_path} label />
        </div>
      )}
    </div>
  );
};

export default ExpenseFields;
