export const CURRENCIES = ['ZAR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'];

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

const formatterCache = new Map();

export const formatMoney = (value, currency = 'USD', { signed = false } = {}) => {
  const key = currency;
  if (!formatterCache.has(key)) {
    formatterCache.set(key, new Intl.NumberFormat(undefined, { style: 'currency', currency }));
  }
  const n = Number(value) || 0;
  const text = formatterCache.get(key).format(n);
  return signed && n > 0 ? `+${text}` : text;
};

// Dates are stored as 'YYYY-MM-DD' (no time zone). Parse them as local dates so
// "2026-03-01" never shows up as Feb 28 for users west of UTC.
export const parseISODate = (iso) => {
  if (!iso) return new Date();
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const toISODate = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const todayISO = () => toISODate(new Date());

export const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

// A sensible default date for a new entry while viewing a given month:
// today if viewing the current month, otherwise the 1st of the viewed month.
export const defaultDateForMonth = (year, month) => {
  const now = new Date();
  if (now.getFullYear() === year && now.getMonth() === month) return todayISO();
  return toISODate(new Date(year, month, 1));
};

export const formatDate = (iso, opts = { day: 'numeric', month: 'short' }) =>
  parseISODate(iso).toLocaleDateString(undefined, opts);

export const formatDateLong = (iso) =>
  formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric' });

export const monthLabel = (year, month) => `${MONTHS[month]} ${year}`;

export const addMonths = (year, month, delta) => {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};

export const monthsBetween = (fromDate, toDate) =>
  (toDate.getFullYear() - fromDate.getFullYear()) * 12 + (toDate.getMonth() - fromDate.getMonth());

export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const percentChange = (current, previous) => {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
};
