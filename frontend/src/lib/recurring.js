import { parseISODate, toISODate, daysInMonth } from './format';

// Expenses use `isRecurring` (legacy camelCase column); income uses `is_recurring`.
export const isRecurringItem = (item) => Boolean(item.isRecurring ?? item.is_recurring);

const monthIndex = (year, month) => year * 12 + month;

/**
 * Returns the entries that apply to a given month. One-off entries appear in the
 * month they happened. Recurring entries appear every month from their start
 * month until `recurring_end` (inclusive), dated on the same day of the month.
 * Each returned entry keeps its original `id` and gains `displayDate` and `isOccurrence`.
 */
export const entriesForMonth = (items, year, month) => {
  const target = monthIndex(year, month);
  const out = [];
  for (const item of items) {
    const start = parseISODate(item.occurred_on);
    const startIdx = monthIndex(start.getFullYear(), start.getMonth());

    if (!isRecurringItem(item)) {
      if (startIdx === target) out.push({ ...item, displayDate: item.occurred_on, isOccurrence: false });
      continue;
    }

    if (startIdx > target) continue;
    if (item.recurring_end) {
      const end = parseISODate(item.recurring_end);
      if (monthIndex(end.getFullYear(), end.getMonth()) < target) continue;
    }
    const day = Math.min(start.getDate(), daysInMonth(year, month));
    out.push({
      ...item,
      displayDate: toISODate(new Date(year, month, day)),
      isOccurrence: startIdx !== target,
    });
  }
  return out.sort((a, b) => (a.displayDate < b.displayDate ? 1 : a.displayDate > b.displayDate ? -1 : 0));
};

export const sumAmounts = (items) => items.reduce((sum, i) => sum + Number(i.amount || 0), 0);

export const totalsByCategory = (items) =>
  items.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + Number(i.amount || 0);
    return acc;
  }, {});

// Last day of the month before (year, month): used to "stop" a recurring entry
// so it no longer appears from the given month onward.
export const endOfPreviousMonth = (year, month) => toISODate(new Date(year, month, 0));
