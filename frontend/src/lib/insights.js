import { entriesForMonth, sumAmounts, totalsByCategory, isRecurringItem } from './recurring';
import { addMonths, daysInMonth, formatMoney, monthLabel, monthsBetween, ordinal, parseISODate, percentChange, todayISO } from './format';

export const monthSummary = ({ expenses, income }, year, month) => {
  const exp = entriesForMonth(expenses, year, month);
  const inc = entriesForMonth(income, year, month);
  return {
    expenses: exp,
    income: inc,
    spent: sumAmounts(exp),
    earned: sumAmounts(inc),
    byCategory: totalsByCategory(exp),
  };
};

// Income vs spending for the `count` months ending at (year, month).
export const monthlySeries = (data, year, month, count = 6) => {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const { year: y, month: m } = addMonths(year, month, -i);
    const s = monthSummary(data, y, m);
    out.push({ key: `${y}-${m}`, year: y, month: m, label: monthLabel(y, m).slice(0, 3), Income: s.earned, Spending: s.spent });
  }
  return out;
};

// Biggest category movements vs the previous month.
export const categoryChanges = (data, year, month) => {
  const cur = monthSummary(data, year, month).byCategory;
  const p = addMonths(year, month, -1);
  const prev = monthSummary(data, p.year, p.month).byCategory;
  const names = new Set([...Object.keys(cur), ...Object.keys(prev)]);
  return [...names]
    .map((name) => ({
      name,
      current: cur[name] || 0,
      previous: prev[name] || 0,
      diff: (cur[name] || 0) - (prev[name] || 0),
      pct: percentChange(cur[name] || 0, prev[name] || 0),
    }))
    .filter((c) => Math.abs(c.diff) > 0.009)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
};

export const goalProgress = (goal, contributions, today = new Date()) => {
  const entries = contributions.filter((c) => c.goal_id === goal.id);
  const saved = sumAmounts(entries);
  const target = Number(goal.target);
  const remaining = Math.max(0, target - saved);
  const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  let monthsLeft = null;
  let perMonth = null;
  let status = remaining <= 0 ? 'done' : 'open';

  if (goal.target_date && remaining > 0) {
    const due = parseISODate(goal.target_date);
    monthsLeft = Math.max(0, monthsBetween(today, due)) + 1; // include the current month
    perMonth = remaining / monthsLeft;
    if (due < today) status = 'overdue';
    else {
      const created = new Date(goal.created_at || today);
      const totalMonths = Math.max(1, monthsBetween(created, due) + 1);
      const elapsed = Math.max(0, monthsBetween(created, today));
      const expected = (target * elapsed) / totalMonths;
      status = saved + 0.01 >= expected ? 'on-track' : 'behind';
    }
  }
  return { saved, target, remaining, pct, monthsLeft, perMonth, status, entries };
};

// Recurring expenses that are still active, with their next due date.
export const activeBills = (expenses, now = new Date()) => {
  const y = now.getFullYear();
  const m = now.getMonth();
  return expenses
    .filter(isRecurringItem)
    .filter((e) => !e.recurring_end || parseISODate(e.recurring_end) >= new Date(y, m, 1))
    .map((e) => {
      const day = parseISODate(e.occurred_on).getDate();
      const start = parseISODate(e.occurred_on);
      let due = new Date(y, m, Math.min(day, daysInMonth(y, m)));
      if (due < new Date(y, m, now.getDate())) {
        const n = addMonths(y, m, 1);
        due = new Date(n.year, n.month, Math.min(day, daysInMonth(n.year, n.month)));
      }
      if (due < start) due = start;
      const daysUntil = Math.round((due - new Date(y, m, now.getDate())) / 86400000);
      return { ...e, dueDay: day, nextDue: due, daysUntil };
    })
    .sort((a, b) => a.nextDue - b.nextDue);
};

/**
 * Smart, specific alerts for the current month. Each has a stable id so the
 * bell can remember which ones were already seen.
 */
export const computeAlerts = ({ expenses, income, categories, goals, goal_contributions }, currency, now = new Date()) => {
  const y = now.getFullYear();
  const m = now.getMonth();
  const day = now.getDate();
  const dim = daysInMonth(y, m);
  const monthPct = day / dim;
  const { byCategory } = monthSummary({ expenses, income }, y, m);
  const fmt = (v) => formatMoney(v, currency);
  const alerts = [];
  const key = `${y}-${m}`;

  categories
    .filter((c) => c.kind === 'expense' && Number(c.budget) > 0)
    .forEach((c) => {
      const spent = byCategory[c.name] || 0;
      const used = spent / Number(c.budget);
      if (used > 1) {
        alerts.push({ id: `over-${c.id}-${key}`, tone: 'danger', title: `${c.name} is over budget`, body: `You’ve spent ${fmt(spent)} of ${fmt(c.budget)}, which is ${fmt(spent - c.budget)} over.`, tab: 'budgets' });
      } else if (used >= 0.85 && used > monthPct + 0.1) {
        alerts.push({ id: `pace-${c.id}-${key}`, tone: 'warning', title: `${c.name} is running hot`, body: `You’ve used ${Math.round(used * 100)}% of your ${c.name} budget and it’s only the ${ordinal(day)}.`, tab: 'budgets' });
      }
    });

  activeBills(expenses, now)
    .filter((b) => b.daysUntil >= 0 && b.daysUntil <= 3)
    .forEach((b) => {
      const when = b.daysUntil === 0 ? 'today' : b.daysUntil === 1 ? 'tomorrow' : `in ${b.daysUntil} days`;
      alerts.push({ id: `bill-${b.id}-${b.nextDue.toDateString()}`, tone: 'info', title: `${b.name} is due ${when}`, body: `${fmt(b.amount)} on the ${ordinal(b.dueDay)}.`, tab: 'bills' });
    });

  goals.forEach((g) => {
    const p = goalProgress(g, goal_contributions, now);
    if (p.status === 'behind') {
      alerts.push({ id: `goal-${g.id}-${key}`, tone: 'warning', title: `${g.name} is behind schedule`, body: `Put aside about ${fmt(p.perMonth)} a month to reach it on time.`, tab: 'goals' });
    }
  });

  return alerts;
};

// Compact snapshot sent to the AI advisor. Numbers only, no personal identifiers.
export const advisorSnapshot = (data, year, month, currency) => {
  const cur = monthSummary(data, year, month);
  const history = monthlySeries(data, year, month, 4).map((s) => ({ month: monthLabel(s.year, s.month), income: round(s.Income), spending: round(s.Spending) }));
  const budgets = data.categories
    .filter((c) => c.kind === 'expense' && Number(c.budget) > 0)
    .map((c) => ({ category: c.name, budget: round(c.budget), spent: round(cur.byCategory[c.name] || 0) }));
  const spendingByCategory = Object.entries(cur.byCategory)
    .map(([category, amount]) => ({ category, amount: round(amount) }))
    .sort((a, b) => b.amount - a.amount);
  const bills = activeBills(data.expenses).map((b) => ({ name: b.name, amount: round(b.amount), category: b.category, due_day: b.dueDay }));
  const goals = data.goals.map((g) => {
    const p = goalProgress(g, data.goal_contributions);
    return { name: g.name, target: round(p.target), saved: round(p.saved), target_date: g.target_date, status: p.status };
  });
  return {
    currency,
    today: todayISO(),
    viewing_month: monthLabel(year, month),
    income: round(cur.earned),
    spending: round(cur.spent),
    left_over: round(cur.earned - cur.spent),
    spending_by_category: spendingByCategory,
    budgets,
    recurring_bills: bills,
    goals,
    history,
  };
};

const round = (n) => Math.round(Number(n || 0) * 100) / 100;

// Plain-language observations shown on the Advisor tab without needing AI.
export const localInsights = (data, year, month, currency) => {
  const fmt = (v) => formatMoney(v, currency);
  const cur = monthSummary(data, year, month);
  const p = addMonths(year, month, -1);
  const prev = monthSummary(data, p.year, p.month);
  const out = [];

  if (cur.earned > 0) {
    const rate = ((cur.earned - cur.spent) / cur.earned) * 100;
    out.push(
      rate >= 20
        ? { tone: 'good', text: `You’re keeping ${Math.round(rate)}% of your income this month. That’s above the 20% many planners aim for.` }
        : rate >= 0
          ? { tone: 'neutral', text: `You’re keeping ${Math.round(rate)}% of your income this month. Getting to 20% would mean ${fmt(cur.earned * 0.2 - (cur.earned - cur.spent))} less spending.` }
          : { tone: 'bad', text: `You’ve spent ${fmt(cur.spent - cur.earned)} more than you earned this month.` }
    );
  } else {
    out.push({ tone: 'neutral', text: `No income recorded for ${monthLabel(year, month)} yet. Add it so these numbers mean something.` });
  }

  if (prev.spent > 0) {
    const pct = percentChange(cur.spent, prev.spent);
    out.push({ tone: pct > 5 ? 'bad' : pct < -5 ? 'good' : 'neutral', text: `Total spending is ${pct >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(pct))}% on last month (${fmt(cur.spent)} vs ${fmt(prev.spent)}).` });
  }

  const changes = categoryChanges(data, year, month).filter((c) => c.previous > 0 && c.diff > 0);
  if (changes[0]) {
    const c = changes[0];
    out.push({ tone: 'bad', text: `${c.name} went up the most: ${fmt(c.current)}, ${fmt(c.diff)} (${Math.round(c.pct)}%) more than last month.` });
  }

  const top = Object.entries(cur.byCategory).sort((a, b) => b[1] - a[1])[0];
  if (top && cur.spent > 0) {
    out.push({ tone: 'neutral', text: `${top[0]} is your biggest expense at ${fmt(top[1])}, ${Math.round((top[1] / cur.spent) * 100)}% of everything you spent.` });
  }

  const subs = activeBills(data.expenses).filter((b) => b.category === 'Subscriptions');
  if (subs.length) {
    out.push({ tone: 'neutral', text: `You have ${subs.length} subscription${subs.length > 1 ? 's' : ''} totalling ${fmt(sumAmounts(subs))} a month. Worth checking you still use them all.` });
  }

  return out;
};
