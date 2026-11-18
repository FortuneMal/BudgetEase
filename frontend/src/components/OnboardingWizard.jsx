import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, X, Check } from 'lucide-react';
import Modal from './ui/Modal';
import { CURRENCIES, formatMoney, toISODate, daysInMonth } from '../lib/format';
import { suggestBudgets, TEMPLATE_SAVINGS_SHARE } from '../lib/budgetTemplate';
import { supabase } from '../utils/supabase';
import { useToast } from '../context/ToastContext';

const STARTER_BILLS = [
  { name: 'Rent or bond', category: 'Housing & Rent', day: 1 },
  { name: 'Electricity', category: 'Utilities', day: 1 },
  { name: 'Phone contract', category: 'Utilities', day: 1 },
  { name: 'Internet', category: 'Utilities', day: 1 },
  { name: 'Insurance', category: 'Insurance', day: 1 },
  { name: 'Streaming', category: 'Subscriptions', day: 1 },
];

const dateThisMonth = (day) => {
  const now = new Date();
  const d = Math.min(Math.max(1, Number(day) || 1), daysInMonth(now.getFullYear(), now.getMonth()));
  return toISODate(new Date(now.getFullYear(), now.getMonth(), d));
};

const Steps = ({ step }) => (
  <div className="flex items-center gap-2 mb-6" aria-label={`Step ${step + 1} of 4`}>
    {['You', 'Income', 'Bills', 'Budgets'].map((label, i) => (
      <div key={label} className="flex-1">
        <div className={`h-1.5 rounded-full ${i <= step ? 'bg-gold-gradient' : 'bg-obsidian-700'}`} />
        <p className={`text-xs mt-1.5 ${i === step ? 'text-gold-500 font-semibold' : 'text-platinum-500'}`}>{label}</p>
      </div>
    ))}
  </div>
);

const OnboardingWizard = ({ open, onClose, user, data, currency, onCurrencyChange }) => {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [cur, setCur] = useState(currency);
  const [income, setIncome] = useState({ source: 'Salary', amount: '', day: 25 });
  const [bills, setBills] = useState(STARTER_BILLS.map((b, i) => ({ ...b, id: i, amount: '' })));
  const [useTemplate, setUseTemplate] = useState(true);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setName(user?.user_metadata?.username || '');
    setCur(currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const expenseNames = data.expenseCategories.map((c) => c.name);
  const pick = (c) => (expenseNames.includes(c) ? c : expenseNames.includes('Other') ? 'Other' : expenseNames[0]);
  const incomeAmount = parseFloat(income.amount) || 0;
  const filledBills = bills.filter((b) => parseFloat(b.amount) > 0 && b.name.trim());
  const billsTotal = filledBills.reduce((s, b) => s + parseFloat(b.amount), 0);

  const proposal = useMemo(() => {
    const fixed = {};
    filledBills.forEach((b) => { const c = pick(b.category); fixed[c] = (fixed[c] || 0) + parseFloat(b.amount); });
    return suggestBudgets(incomeAmount, data.categories.filter((c) => c.kind === 'expense' && !c.archived), fixed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomeAmount, bills, data.categories]);

  const setBill = (id, patch) => setBills((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const finish = async () => {
    setBusy(true);
    try {
      if (cur !== currency) await onCurrencyChange(cur);
      if (incomeAmount > 0) {
        await data.addIncome({ source: income.source.trim() || 'Salary', amount: incomeAmount, category: data.incomeCategories.find((c) => c.name === 'Salary') ? 'Salary' : data.incomeCategories[0]?.name, occurred_on: dateThisMonth(income.day), is_recurring: true });
      }
      if (filledBills.length) {
        await data.insertRows('expenses', filledBills.map((b) => ({ name: b.name.trim(), amount: parseFloat(b.amount), category: pick(b.category), occurred_on: dateThisMonth(b.day), isRecurring: true })));
      }
      if (useTemplate && incomeAmount > 0 && proposal.length) {
        await data.setBudgetsBulk(proposal.map((p) => ({ id: p.id, budget: p.budget })));
      }
      await supabase.auth.updateUser({ data: { username: name.trim() || user?.user_metadata?.username, onboarded: true } });
      toast({ message: 'You’re all set. Here’s your month.' });
      onClose(true);
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    await supabase.auth.updateUser({ data: { onboarded: true } });
    onClose(false);
  };

  const footer = (
    <>
      {step === 0 ? <button className="btn-ghost" onClick={skip}>Skip setup</button> : <button className="btn-ghost" onClick={() => setStep(step - 1)} disabled={busy}>Back</button>}
      {step < 3 ? (
        <button className="btn-primary" onClick={() => setStep(step + 1)}>{step === 1 && !incomeAmount ? 'Skip' : step === 2 && !filledBills.length ? 'Skip' : 'Next'}</button>
      ) : (
        <button className="btn-primary" onClick={finish} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}Finish</button>
      )}
    </>
  );

  return (
    <Modal open={open} onClose={() => onClose(false)} title="Let’s set up your budget" subtitle="About two minutes. You can change everything later." size="lg" footer={footer}>
      <Steps step={step} />

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="ob-name">What should we call you?</label>
            <input id="ob-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} />
          </div>
          <div>
            <label className="label" htmlFor="ob-cur">Which currency do you use?</label>
            <select id="ob-cur" className="input" value={cur} onChange={(e) => setCur(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-platinum-300">How much lands in your account each month after tax? We’ll add it automatically every month.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="label" htmlFor="ob-src">From</label>
              <input id="ob-src" className="input" value={income.source} onChange={(e) => setIncome({ ...income, source: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="ob-amt">Take-home pay ({cur})</label>
              <input id="ob-amt" className="input" type="number" inputMode="decimal" min="0" value={income.amount} onChange={(e) => setIncome({ ...income, amount: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="label" htmlFor="ob-day">Payday (day of month)</label>
              <input id="ob-day" className="input" type="number" min="1" max="31" value={income.day} onChange={(e) => setIncome({ ...income, day: e.target.value })} />
            </div>
          </div>
          <p className="hint">Paid irregularly? Skip this and add income as it comes in.</p>
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="text-platinum-300 mb-4">What do you pay every month? Fill in the ones that apply and leave the rest blank.</p>
          <div className="space-y-2">
            <div className="hidden sm:grid grid-cols-[1fr_8rem_6rem_2rem] gap-2 text-sm text-platinum-500 px-1">
              <span>Bill</span><span>Amount</span><span>Day</span><span />
            </div>
            {bills.map((b) => (
              <div key={b.id} className="grid grid-cols-[1fr_6.5rem_4rem_2rem] sm:grid-cols-[1fr_8rem_6rem_2rem] gap-2 items-center">
                <input className="input !py-2" value={b.name} onChange={(e) => setBill(b.id, { name: e.target.value })} aria-label="Bill name" />
                <input className="input !py-2" type="number" inputMode="decimal" min="0" placeholder="0" value={b.amount} onChange={(e) => setBill(b.id, { amount: e.target.value })} aria-label={`${b.name} amount`} />
                <input className="input !py-2" type="number" min="1" max="31" value={b.day} onChange={(e) => setBill(b.id, { day: e.target.value })} aria-label={`${b.name} day of month`} />
                <button className="icon-btn" onClick={() => setBills((bs) => bs.filter((x) => x.id !== b.id))} aria-label={`Remove ${b.name}`}><X size={16} /></button>
              </div>
            ))}
          </div>
          <button className="btn-ghost mt-3 !py-2" onClick={() => setBills((bs) => [...bs, { id: Date.now(), name: '', amount: '', day: 1, category: 'Other' }])}><Plus size={16} /> Add another</button>
          {billsTotal > 0 && <p className="text-sm text-platinum-400 mt-4">Fixed costs: <span className="text-white font-semibold">{formatMoney(billsTotal, cur)}</span> a month{incomeAmount ? `, ${Math.round((billsTotal / incomeAmount) * 100)}% of your pay` : ''}.</p>}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          {incomeAmount > 0 ? (
            <>
              <button onClick={() => setUseTemplate(true)} className={`w-full text-left rounded-xl border p-4 ${useTemplate ? 'border-gold-500 bg-gold-500/5' : 'border-obsidian-600'}`}>
                <p className="font-semibold text-white">Start with the 50/30/20 rule (recommended)</p>
                <p className="text-sm text-platinum-400 mt-1">Half your pay for needs, 30% for wants, 20% for saving. That’s about {formatMoney(incomeAmount * TEMPLATE_SAVINGS_SHARE, cur)} a month towards your goals.</p>
                {useTemplate && (
                  <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    {proposal.slice(0, 8).map((p) => (
                      <li key={p.id} className="flex justify-between"><span className="text-platinum-300">{p.name}</span><span className="text-white tabular-nums">{formatMoney(p.budget, cur)}</span></li>
                    ))}
                  </ul>
                )}
              </button>
              <button onClick={() => setUseTemplate(false)} className={`w-full text-left rounded-xl border p-4 ${!useTemplate ? 'border-gold-500 bg-gold-500/5' : 'border-obsidian-600'}`}>
                <p className="font-semibold text-white">I’ll set my own budgets</p>
                <p className="text-sm text-platinum-400 mt-1">You can do it any time from the Budgets tab.</p>
              </button>
            </>
          ) : (
            <p className="text-platinum-300">Add your income in step 2 to get suggested budgets, or set them yourself later from the Budgets tab.</p>
          )}
        </div>
      )}
    </Modal>
  );
};

export default OnboardingWizard;
