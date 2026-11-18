import { toISODate } from './format';

// Minimal RFC-4180 CSV parser: quoted fields, escaped quotes, CRLF, and ; or , or tab delimiters.
export const parseCSV = (text) => {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim()) || '';
  const delimiter = [',', ';', '\t'].reduce(
    (best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best),
    ','
  );

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) { row.push(field.trim()); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field.trim());
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
};

// Bank exports often have a few lines of account info before the real header.
// Pick the first row that looks like a header (mentions date + amount-ish words).
export const findHeaderRow = (rows) => {
  const idx = rows.findIndex((r) => {
    const joined = r.join(' ').toLowerCase();
    return /date/.test(joined) && /(amount|debit|credit|value|money)/.test(joined);
  });
  return idx === -1 ? 0 : idx;
};

export const guessColumns = (header) => {
  const h = header.map((x) => x.toLowerCase());
  const find = (...words) => h.findIndex((c) => words.some((w) => c.includes(w)));
  return {
    date: find('date'),
    description: find('description', 'details', 'narrative', 'reference', 'payee', 'merchant', 'transaction'),
    amount: find('amount', 'value'),
    debit: find('debit', 'money out', 'withdrawal'),
    credit: find('credit', 'money in', 'deposit'),
  };
};

export const parseAmount = (raw) => {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || /-/.test(s) || /\bdr\b/i.test(s);
  s = s.replace(/[^\d.,]/g, '');
  // "1.234,56" (European) -> 1234.56 ; "1,234.56" -> 1234.56 ; "1234,56" -> 1234.56
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    const parts = s.split(',');
    s = parts[parts.length - 1].length === 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return negative ? -Math.abs(n) : n;
};

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Parses common bank date formats. `dayFirst` decides ambiguous 03/04/2026 cases.
 * Returns 'YYYY-MM-DD' or null.
 */
export const parseBankDate = (raw, dayFirst = true) => {
  const s = String(raw || '').trim();
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return valid(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return dayFirst ? valid(y, +m[2], +m[1]) : valid(y, +m[1], +m[2]);
  }
  if ((m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-](\d{2,4})/))) {
    const mon = MONTH_NAMES.indexOf(m[2].toLowerCase()) + 1;
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return mon ? valid(y, mon, +m[1]) : null;
  }
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return valid(+m[1], +m[2], +m[3]);
  return null;
};

const valid = (y, mo, d) => {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d);
  if (date.getMonth() !== mo - 1) return null;
  return toISODate(date);
};

const escapeCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCSV = (header, rows) =>
  [header, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n');

export const downloadFile = (filename, content, type = 'text/csv;charset=utf-8') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
