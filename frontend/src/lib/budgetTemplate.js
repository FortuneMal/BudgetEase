// Starting shares of monthly take-home pay, following the 50/30/20 rule:
// 50% needs, 30% wants, 20% saving and debt (most of which goes to goals, not a category).
const SHARES = {
  'Housing & Rent': 0.25,
  Groceries: 0.10,
  Transport: 0.07,
  Utilities: 0.04,
  Insurance: 0.02,
  Health: 0.02,
  'Dining Out': 0.06,
  Subscriptions: 0.03,
  Entertainment: 0.05,
  Shopping: 0.08,
  'Personal Care': 0.03,
  Other: 0.05,
  'Debt Repayments': 0.05,
};

export const TEMPLATE_SAVINGS_SHARE = 0.15;

const roundNice = (n) => (n >= 1000 ? Math.round(n / 50) * 50 : n >= 100 ? Math.round(n / 10) * 10 : Math.round(n));

/**
 * Suggests a budget per category from monthly income.
 * If a fixed bill (recurring expense) is bigger than the suggested share, use the bill amount:
 * there's no point budgeting R5,000 for rent that costs R7,500.
 */
export const suggestBudgets = (monthlyIncome, categories, recurringByCategory = {}) =>
  categories
    .filter((c) => c.kind === 'expense')
    .map((c) => {
      const share = SHARES[c.name] || 0;
      const suggested = roundNice(monthlyIncome * share);
      const fixed = recurringByCategory[c.name] || 0;
      return { id: c.id, name: c.name, budget: Math.max(suggested, Math.ceil(fixed)) };
    })
    .filter((s) => s.budget > 0);
