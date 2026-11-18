import React, { useCallback, useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LogOut, ChevronLeft, ChevronRight, Plus, LayoutDashboard, Receipt, PieChart, MoreHorizontal,
  Wallet, Target, CalendarDays, Sparkles, Settings, Database,
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import useBudgetData from '../hooks/useBudgetData';
import { monthSummary } from '../lib/insights';
import { addMonths, monthLabel, defaultDateForMonth } from '../lib/format';
import { friendlyError } from '../lib/errors';
import { useToast } from '../context/ToastContext';
import ThemeToggle from './ThemeToggle';
import NotificationsBell from './NotificationsBell';
import MetricCards from './MetricCards';
import ExpenseModal from './ExpenseModal';
import Modal from './ui/Modal';

const OverviewTab = lazy(() => import('./OverviewTab'));
const ExpensesTab = lazy(() => import('./ExpensesTab'));
const IncomeTab = lazy(() => import('./IncomeTab'));
const BudgetsTab = lazy(() => import('./BudgetsTab'));
const BillsTab = lazy(() => import('./BillsTab'));
const GoalsTab = lazy(() => import('./GoalsTab'));
const AdvisorTab = lazy(() => import('./SavingTipsTab'));
const SettingsTab = lazy(() => import('./SettingsTab'));
const ImportStatementModal = lazy(() => import('./ImportStatementModal'));
const OnboardingWizard = lazy(() => import('./OnboardingWizard'));

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'expenses', label: 'Spending', icon: Receipt },
  { id: 'income', label: 'Income', icon: Wallet },
  { id: 'budgets', label: 'Budgets', icon: PieChart },
  { id: 'bills', label: 'Bills', icon: CalendarDays },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'advisor', label: 'Advisor', icon: Sparkles },
  { id: 'settings', label: 'Settings', icon: Settings },
];
const MOBILE_PRIMARY = ['overview', 'expenses', 'budgets'];

const DashboardPage = ({ user: initialUser, theme, toggleTheme }) => {
  const { toast } = useToast();
  const [user, setUser] = useState(initialUser);
  const [currency, setCurrency] = useState(initialUser?.user_metadata?.currency || 'USD');
  const [activeTab, setActiveTab] = useState('overview');
  const [settingsFocus, setSettingsFocus] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [expenseModal, setExpenseModal] = useState({ open: false });
  const [importOpen, setImportOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const { year, month } = ym;

  const data = useBudgetData(user);
  const summary = useMemo(() => monthSummary(data, year, month), [data, year, month]);
  const totalBudget = data.expenseCategories.reduce((s, c) => s + (Number(c.budget) || 0), 0);

  // Keep user metadata (name, currency, onboarded) fresh after updates
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'USER_UPDATED' && session?.user) setUser(session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // First-run setup for brand-new accounts
  useEffect(() => {
    if (data.loading || data.needsMigration) return;
    const fresh = !user?.user_metadata?.onboarded && data.expenses.length === 0 && data.income.length === 0;
    if (fresh && data.expenseCategories.length) setSetupOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.loading, data.needsMigration]);

  // "Install app" support (Android/desktop Chrome, Edge)
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
  };

  const changeCurrency = useCallback(async (next) => {
    const { error } = await supabase.auth.updateUser({ data: { currency: next } });
    if (error) { toast({ tone: 'error', message: friendlyError(error) }); return false; }
    setCurrency(next);
    return true;
  }, [toast]);

  const goTab = (id, focus = null) => {
    setActiveTab(id);
    setSettingsFocus(focus);
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const shiftMonth = (delta) => setYm((cur) => addMonths(cur.year, cur.month, delta));
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const openAddExpense = (opts = {}) =>
    setExpenseModal({ open: true, expense: null, mode: opts.mode || 'describe', defaults: { occurred_on: defaultDateForMonth(year, month), ...opts.defaults } });
  const openEditExpense = (expense) => setExpenseModal({ open: true, expense });

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const name = user?.user_metadata?.username || user?.email?.split('@')[0] || 'there';

  const tabProps = { data, year, month, currency };

  return (
    <div className="min-h-screen font-sans bg-obsidian-900 pb-24 md:pb-10">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-obsidian-700/60 bg-obsidian-900/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <button className="flex items-center gap-2.5" onClick={() => goTab('overview')} aria-label="BudgetEase home">
            <span className="w-9 h-9 bg-gold-gradient rounded-xl flex items-center justify-center font-serif text-xl font-bold text-[#0a0a0a]">B</span>
            <span className="text-xl font-serif text-white hidden sm:inline">BudgetEase</span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationsBell data={data} currency={currency} onNavigate={goTab} />
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            <button onClick={signOut} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-platinum-400 hover:text-gold-400 hover:bg-obsidian-800" aria-label="Sign out">
              <LogOut size={18} /><span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        {/* Desktop tabs */}
        <nav className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Main">
          <ul className="flex gap-1 -mb-px">
            {TABS.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => goTab(t.id)}
                  aria-current={activeTab === t.id ? 'page' : undefined}
                  className={`relative flex items-center gap-2 px-3 lg:px-4 py-3 text-sm font-medium transition-colors ${activeTab === t.id ? 'text-gold-500' : 'text-platinum-400 hover:text-platinum-100'}`}
                >
                  <t.icon size={16} /> {t.label}
                  {activeTab === t.id && <motion.span layoutId="tab-underline" className="absolute left-2 right-2 -bottom-px h-0.5 bg-gold-gradient rounded-full" />}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {data.needsMigration && (
          <div className="mb-6 rounded-2xl border border-gold-500/40 bg-gold-500/5 p-4 sm:p-5 flex gap-3">
            <Database size={20} className="text-gold-500 shrink-0 mt-0.5" />
            <div className="text-sm text-platinum-200">
              <p className="font-semibold text-white">One-time database update needed</p>
              <p className="mt-1">Run <code className="px-1.5 py-0.5 rounded bg-obsidian-900 text-gold-400">supabase/migrations/20261116000000_core_budgeting.sql</code> in the Supabase SQL editor, then refresh. Until then, income, budgets and goals can’t be saved.</p>
            </div>
          </div>
        )}

        {/* Greeting + month switcher */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-white">Hi, {name}</h1>
            <p className="text-platinum-400 mt-1">{activeTab === 'overview' ? `Here’s how ${monthLabel(year, month)} is going.` : TABS.find((t) => t.id === activeTab)?.label}</p>
          </div>
          {activeTab !== 'settings' && (
            <div className="flex items-center gap-1 self-start sm:self-auto rounded-xl border border-obsidian-700 bg-obsidian-800/60 p-1">
              <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
              <span className="min-w-[9.5rem] text-center font-semibold text-platinum-100" aria-live="polite">{monthLabel(year, month)}</span>
              <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight size={18} /></button>
              {!isCurrentMonth && (
                <button className="text-sm font-medium text-gold-500 hover:text-gold-400 px-2" onClick={() => setYm({ year: now.getFullYear(), month: now.getMonth() })}>Today</button>
              )}
            </div>
          )}
        </div>

        {data.loading ? (
          <div className="space-y-4" aria-busy="true">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-obsidian-800/60 animate-pulse" />)}</div>
            <div className="h-80 rounded-2xl bg-obsidian-800/60 animate-pulse" />
          </div>
        ) : (
          <Suspense fallback={<div className="h-80 rounded-2xl bg-obsidian-800/60 animate-pulse" />}>
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <MetricCards earned={summary.earned} spent={summary.spent} totalBudget={totalBudget} currency={currency} setActiveTab={goTab} />
                    <OverviewTab {...tabProps} summary={summary} setActiveTab={goTab} onAddExpense={openAddExpense} onEditExpense={openEditExpense} onStartSetup={() => setSetupOpen(true)} />
                  </div>
                )}
                {activeTab === 'expenses' && <ExpensesTab {...tabProps} onAddExpense={openAddExpense} onEditExpense={openEditExpense} onImport={() => setImportOpen(true)} />}
                {activeTab === 'income' && <IncomeTab {...tabProps} />}
                {activeTab === 'budgets' && <BudgetsTab {...tabProps} onManageCategories={() => goTab('settings', 'categories')} />}
                {activeTab === 'bills' && <BillsTab {...tabProps} onAddBill={() => openAddExpense({ mode: 'manual', defaults: { isRecurring: true } })} onEditExpense={openEditExpense} />}
                {activeTab === 'goals' && <GoalsTab {...tabProps} />}
                {activeTab === 'advisor' && <AdvisorTab {...tabProps} />}
                {activeTab === 'settings' && (
                  <SettingsTab
                    {...tabProps}
                    user={user}
                    onCurrencyChange={changeCurrency}
                    theme={theme}
                    toggleTheme={toggleTheme}
                    onImport={() => setImportOpen(true)}
                    onStartSetup={() => setSetupOpen(true)}
                    focusSection={settingsFocus}
                    installPrompt={installPrompt}
                    onInstall={install}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </Suspense>
        )}
      </main>

      {/* Desktop quick add */}
      <button
        onClick={() => openAddExpense()}
        className="hidden md:flex fixed bottom-6 right-6 z-40 btn-primary !rounded-full !px-6 !py-4 shadow-2xl"
        aria-label="Add expense"
      >
        <Plus size={20} /> Add expense
      </button>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-obsidian-700 bg-obsidian-900/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]" aria-label="Main">
        <ul className="grid grid-cols-5 items-end">
          {MOBILE_PRIMARY.slice(0, 2).map((id) => {
            const t = TABS.find((x) => x.id === id);
            return <MobileNavItem key={id} tab={t} active={activeTab === id} onClick={() => goTab(id)} />;
          })}
          <li className="flex justify-center">
            <button onClick={() => openAddExpense()} className="-mt-6 w-14 h-14 rounded-full bg-gold-gradient text-[#0a0a0a] flex items-center justify-center shadow-[0_8px_24px_rgba(212,175,55,0.4)]" aria-label="Add expense">
              <Plus size={26} />
            </button>
          </li>
          <MobileNavItem tab={TABS.find((x) => x.id === 'budgets')} active={activeTab === 'budgets'} onClick={() => goTab('budgets')} />
          <MobileNavItem
            tab={{ id: 'more', label: 'More', icon: MoreHorizontal }}
            active={!MOBILE_PRIMARY.includes(activeTab)}
            onClick={() => setMoreOpen(true)}
          />
        </ul>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <ul className="grid grid-cols-3 gap-3">
          {TABS.filter((t) => !MOBILE_PRIMARY.includes(t.id)).map((t) => (
            <li key={t.id}>
              <button onClick={() => goTab(t.id)} className={`w-full flex flex-col items-center gap-2 rounded-xl border p-4 ${activeTab === t.id ? 'border-gold-500 text-gold-500' : 'border-obsidian-700 text-platinum-200'}`}>
                <t.icon size={22} /> <span className="text-sm font-medium">{t.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      <ExpenseModal
        open={expenseModal.open}
        onClose={() => setExpenseModal({ open: false })}
        startMode={expenseModal.mode}
        expense={expenseModal.expense}
        defaults={expenseModal.defaults}
        categories={data.expenseCategories}
        currency={currency}
        userId={user?.id}
        onAdd={data.addExpense}
        onUpdate={data.updateExpense}
      />

      <Suspense fallback={null}>
        {importOpen && <ImportStatementModal open={importOpen} onClose={() => setImportOpen(false)} data={data} currency={currency} />}
        {setupOpen && (
          <OnboardingWizard
            open={setupOpen}
            onClose={() => setSetupOpen(false)}
            user={user}
            data={data}
            currency={currency}
            onCurrencyChange={changeCurrency}
          />
        )}
      </Suspense>
    </div>
  );
};

const MobileNavItem = ({ tab, active, onClick }) => (
  <li>
    <button onClick={onClick} aria-current={active ? 'page' : undefined} className={`w-full flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${active ? 'text-gold-500' : 'text-platinum-400'}`}>
      <tab.icon size={22} />
      {tab.label}
    </button>
  </li>
);

export default DashboardPage;
