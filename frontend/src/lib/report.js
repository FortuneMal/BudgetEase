import { monthSummary, goalProgress } from './insights';
import { formatMoney, formatDateLong, monthLabel } from './format';
import { toCSV, downloadFile } from './csv';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const exportMonthCSV = (data, year, month) => {
  const s = monthSummary(data, year, month);
  const rows = [
    ...s.income.map((i) => [i.displayDate, 'Income', i.source, i.category, Number(i.amount).toFixed(2), i.is_recurring ? 'Yes' : 'No']),
    ...s.expenses.map((e) => [e.displayDate, 'Expense', e.name, e.category, (-Number(e.amount)).toFixed(2), e.isRecurring ? 'Yes' : 'No']),
  ].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const csv = toCSV(['Date', 'Type', 'Description', 'Category', 'Amount', 'Recurring'], rows);
  downloadFile(`budgetease-${year}-${String(month + 1).padStart(2, '0')}.csv`, csv);
};

export const exportAllCSV = (data) => {
  const rows = [
    ...data.income.map((i) => [i.occurred_on, 'Income', i.source, i.category, Number(i.amount).toFixed(2), i.is_recurring ? 'Yes' : 'No', i.recurring_end || '']),
    ...data.expenses.map((e) => [e.occurred_on, 'Expense', e.name, e.category, (-Number(e.amount)).toFixed(2), e.isRecurring ? 'Yes' : 'No', e.recurring_end || '']),
  ].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  downloadFile('budgetease-all-transactions.csv', toCSV(['Date', 'Type', 'Description', 'Category', 'Amount', 'Recurring', 'Recurring ends'], rows));
};

// Opens a clean, printable monthly statement. The browser's print dialog can save it as PDF.
export const openMonthlyReport = (data, year, month, currency, name) => {
  const fmt = (v) => formatMoney(v, currency);
  const s = monthSummary(data, year, month);
  const budgets = Object.fromEntries(data.categories.filter((c) => c.kind === 'expense').map((c) => [c.name, Number(c.budget) || 0]));
  const cats = [...new Set([...Object.keys(s.byCategory), ...Object.keys(budgets).filter((k) => budgets[k] > 0)])]
    .map((n) => ({ n, spent: s.byCategory[n] || 0, budget: budgets[n] || 0 }))
    .sort((a, b) => b.spent - a.spent);

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>BudgetEase – ${esc(monthLabel(year, month))}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:40px;font-size:13px}
  h1{font-size:24px;margin:0} h2{font-size:15px;margin:28px 0 8px;border-bottom:2px solid #d4af37;padding-bottom:4px}
  .muted{color:#666} .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}
  .tile{border:1px solid #ddd;border-radius:8px;padding:12px} .tile b{display:block;font-size:18px;margin-top:4px}
  table{width:100%;border-collapse:collapse} th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee}
  th{font-size:11px;text-transform:uppercase;color:#666} td.r,th.r{text-align:right} .over{color:#c0392b;font-weight:600}
  @media print{body{margin:16mm}}
</style></head><body>
<h1>Monthly statement · ${esc(monthLabel(year, month))}</h1>
<div class="muted">${esc(name || '')} · Generated ${esc(new Date().toLocaleDateString())} · Amounts in ${esc(currency)}</div>
<div class="grid">
  <div class="tile">Income<b>${fmt(s.earned)}</b></div>
  <div class="tile">Spending<b>${fmt(s.spent)}</b></div>
  <div class="tile">Left over<b>${fmt(s.earned - s.spent)}</b></div>
  <div class="tile">Saved rate<b>${s.earned > 0 ? Math.round(((s.earned - s.spent) / s.earned) * 100) + '%' : '–'}</b></div>
</div>
<h2>Spending by category</h2>
<table><tr><th>Category</th><th class="r">Spent</th><th class="r">Budget</th><th class="r">Difference</th></tr>
${cats.map((c) => `<tr><td>${esc(c.n)}</td><td class="r">${fmt(c.spent)}</td><td class="r">${c.budget ? fmt(c.budget) : '–'}</td><td class="r ${c.budget && c.spent > c.budget ? 'over' : ''}">${c.budget ? fmt(c.budget - c.spent) : '–'}</td></tr>`).join('')}
</table>
${data.goals.length ? `<h2>Goals</h2><table><tr><th>Goal</th><th class="r">Saved</th><th class="r">Target</th><th class="r">Progress</th></tr>
${data.goals.map((g) => { const p = goalProgress(g, data.goal_contributions); return `<tr><td>${esc(g.name)}</td><td class="r">${fmt(p.saved)}</td><td class="r">${fmt(p.target)}</td><td class="r">${Math.round(p.pct)}%</td></tr>`; }).join('')}</table>` : ''}
<h2>Income</h2>
<table><tr><th>Date</th><th>Source</th><th>Category</th><th class="r">Amount</th></tr>
${s.income.map((i) => `<tr><td>${esc(formatDateLong(i.displayDate))}</td><td>${esc(i.source)}</td><td>${esc(i.category)}</td><td class="r">${fmt(i.amount)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">None recorded</td></tr>'}
</table>
<h2>Expenses</h2>
<table><tr><th>Date</th><th>Description</th><th>Category</th><th class="r">Amount</th></tr>
${s.expenses.map((e) => `<tr><td>${esc(formatDateLong(e.displayDate))}</td><td>${esc(e.name)}${e.isRecurring ? ' <span class="muted">(monthly)</span>' : ''}</td><td>${esc(e.category)}</td><td class="r">${fmt(e.amount)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">None recorded</td></tr>'}
</table>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
};
