import React, { useEffect, useRef, useState } from 'react';
import { User, Coins, Palette, Tags, Database, ArrowRightLeft, ShieldCheck, Loader2, Upload, Download, FileText, Rocket, Moon, Sun, Smartphone } from 'lucide-react';
import CategoryManager from './CategoryManager';
import CurrencyConverter, { fetchRate } from './CurrencyConverter';
import { supabase } from '../utils/supabase';
import { CURRENCIES, monthLabel } from '../lib/format';
import { exportMonthCSV, exportAllCSV, openMonthlyReport } from '../lib/report';
import { friendlyError } from '../lib/errors';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';

const Section = ({ id, icon: Icon, title, description, children, innerRef }) => (
  <section id={id} ref={innerRef} className="card scroll-mt-24">
    <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Icon size={20} className="text-gold-500" /> {title}</h2>
    {description && <p className="text-platinum-400 mt-1">{description}</p>}
    <div className="mt-5">{children}</div>
  </section>
);

const SettingsTab = ({ user, data, currency, onCurrencyChange, theme, toggleTheme, year, month, onImport, onStartSetup, focusSection, installPrompt, onInstall }) => {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [name, setName] = useState(user?.user_metadata?.username || '');
  const [savingName, setSavingName] = useState(false);
  const [currencyBusy, setCurrencyBusy] = useState(false);
  const categoriesRef = useRef(null);

  useEffect(() => {
    if (focusSection === 'categories') categoriesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [focusSection]);

  const saveName = async (e) => {
    e.preventDefault();
    setSavingName(true);
    const { error } = await supabase.auth.updateUser({ data: { username: name.trim() } });
    setSavingName(false);
    toast(error ? { tone: 'error', message: friendlyError(error) } : { message: 'Name updated' });
  };

  const changeCurrency = async (next) => {
    if (next === currency) return;
    setCurrencyBusy(true);
    let rate = null;
    try { rate = await fetchRate(currency, next); } catch { /* offer relabel only */ }
    setCurrencyBusy(false);

    const hasData = data.expenses.length || data.income.length || data.goals.length;
    let choice = 'relabel';
    if (hasData) {
      choice = await confirm({
        title: `Switch from ${currency} to ${next}?`,
        message: rate
          ? `Convert everything you’ve recorded at today’s rate (1 ${currency} = ${rate.toFixed(4)} ${next}), or keep the numbers as they are and just change the symbol (choose this if you entered the wrong currency to begin with).`
          : `We couldn’t get an exchange rate right now, so we can only change the symbol. Your numbers will stay the same.`,
        choices: rate
          ? [
              { value: 'relabel', label: 'Just change the symbol', tone: 'secondary' },
              { value: 'convert', label: `Convert to ${next}`, tone: 'primary' },
            ]
          : [{ value: 'relabel', label: 'Change the symbol', tone: 'primary' }],
      });
      if (!choice) return;
    }

    setCurrencyBusy(true);
    if (choice === 'convert') {
      const ok = await data.convertAllAmounts(rate);
      if (!ok) { setCurrencyBusy(false); return; }
    }
    const ok = await onCurrencyChange(next);
    setCurrencyBusy(false);
    if (ok) toast({ message: choice === 'convert' ? `Converted everything to ${next}` : `Currency set to ${next}` });
  };

  const sendReset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: window.location.origin });
    toast(error ? { tone: 'error', message: friendlyError(error) } : { message: `We’ve emailed a reset link to ${user.email}` });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Section icon={User} title="Profile">
        <form onSubmit={saveName} className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="label" htmlFor="set-name">Your name</label>
            <input id="set-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
          </div>
          <button className="btn-primary" disabled={savingName || !name.trim() || name.trim() === user?.user_metadata?.username}>
            {savingName && <Loader2 size={16} className="animate-spin" />}Save
          </button>
        </form>
        <p className="hint">Signed in as {user?.email}</p>
      </Section>

      <Section icon={Coins} title="Currency" description="All your amounts are shown in this currency.">
        <div className="flex items-center gap-3">
          <select className="input sm:!w-60" value={currency} onChange={(e) => changeCurrency(e.target.value)} disabled={currencyBusy} aria-label="Currency">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {currencyBusy && <Loader2 size={18} className="animate-spin text-gold-500" />}
        </div>
      </Section>

      <Section icon={Palette} title="Appearance">
        <div className="segmented" role="group" aria-label="Theme">
          <button aria-pressed={theme === 'dark'} onClick={() => theme !== 'dark' && toggleTheme()} className="flex items-center gap-2"><Moon size={16} /> Dark</button>
          <button aria-pressed={theme === 'light'} onClick={() => theme !== 'light' && toggleTheme()} className="flex items-center gap-2"><Sun size={16} /> Light</button>
        </div>
      </Section>

      <Section id="categories" innerRef={categoriesRef} icon={Tags} title="Categories" description="Make the categories match your life.">
        <CategoryManager data={data} />
      </Section>

      <Section icon={Database} title="Your data" description="Bring in transactions from your bank, or take your data with you.">
        <div className="grid sm:grid-cols-2 gap-3">
          <button className="btn-ghost justify-start" onClick={onImport}><Upload size={16} /> Import bank statement (CSV)</button>
          <button className="btn-ghost justify-start" onClick={() => { if (!openMonthlyReport(data, year, month, currency, name)) toast({ tone: 'error', message: 'Allow pop-ups for this site to open the report.' }); }}>
            <FileText size={16} /> {monthLabel(year, month)} report (PDF)
          </button>
          <button className="btn-ghost justify-start" onClick={() => exportMonthCSV(data, year, month)}><Download size={16} /> Export {monthLabel(year, month)} (CSV)</button>
          <button className="btn-ghost justify-start" onClick={() => exportAllCSV(data)}><Download size={16} /> Export everything (CSV)</button>
        </div>
        <p className="hint">For the PDF, choose “Save as PDF” in the print window.</p>
      </Section>

      <Section icon={ArrowRightLeft} title="Currency converter" description="Handy for travel or buying from overseas.">
        <CurrencyConverter baseCurrency={currency} />
      </Section>

      {installPrompt && (
        <Section icon={Smartphone} title="Install the app" description="Add BudgetEase to your home screen for one-tap access, like a normal app.">
          <button className="btn-primary" onClick={onInstall}><Smartphone size={16} /> Install BudgetEase</button>
        </Section>
      )}

      <Section icon={ShieldCheck} title="Account">
        <div className="flex flex-wrap gap-3">
          <button className="btn-ghost" onClick={sendReset}>Email me a password reset link</button>
          <button className="btn-ghost" onClick={onStartSetup}><Rocket size={16} /> Run guided setup again</button>
        </div>
      </Section>
    </div>
  );
};

export default SettingsTab;
