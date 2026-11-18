import React from 'react';
import { TrendingUp, TrendingDown, PiggyBank, Wallet } from 'lucide-react';
import { formatMoney } from '../lib/format';

const Card = ({ label, value, sub, icon: Icon, tone = 'default', onClick }) => (
  <button
    onClick={onClick}
    className={`glass-card glass-card-hover rounded-2xl p-4 sm:p-5 text-left w-full ${tone === 'danger' ? '!border-red-500/40' : ''}`}
  >
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm font-medium text-platinum-400">{label}</span>
      <Icon size={18} className={tone === 'danger' ? 'text-red-400' : tone === 'good' ? 'text-emerald-500' : 'text-gold-500'} />
    </div>
    <p className={`text-xl sm:text-2xl lg:text-3xl font-semibold tabular-nums tracking-tight ${tone === 'danger' ? 'text-red-400' : 'text-white'}`}>{value}</p>
    {sub && <p className="text-sm text-platinum-500 mt-1 truncate">{sub}</p>}
  </button>
);

const MetricCards = ({ earned, spent, totalBudget, currency, setActiveTab }) => {
  const net = earned - spent;
  const left = totalBudget - spent;
  const rate = earned > 0 ? Math.round((net / earned) * 100) : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <Card label="Income" value={formatMoney(earned, currency)} icon={TrendingUp} onClick={() => setActiveTab('income')} sub="This month" />
      <Card label="Spent" value={formatMoney(spent, currency)} icon={TrendingDown} onClick={() => setActiveTab('expenses')} sub="This month" />
      <Card
        label="Left over"
        value={formatMoney(net, currency)}
        icon={PiggyBank}
        tone={net < 0 ? 'danger' : 'good'}
        sub={rate === null ? 'Add income to see this' : net < 0 ? 'Spent more than earned' : `${rate}% of income kept`}
        onClick={() => setActiveTab('goals')}
      />
      <Card
        label="Left to spend"
        value={totalBudget > 0 ? formatMoney(left, currency) : 'No budget'}
        icon={Wallet}
        tone={totalBudget > 0 && left < 0 ? 'danger' : 'default'}
        sub={totalBudget > 0 ? (left < 0 ? 'Over your total budget' : `of ${formatMoney(totalBudget, currency)} budget`) : 'Tap to set budgets'}
        onClick={() => setActiveTab('budgets')}
      />
    </div>
  );
};

export default MetricCards;
