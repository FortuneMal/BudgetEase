import React, { useMemo, useRef, useState } from 'react';
import { FileUp, Loader2, AlertTriangle } from 'lucide-react';
import Modal from './ui/Modal';
import { parseCSV, findHeaderRow, guessColumns, parseAmount, parseBankDate } from '../lib/csv';
import { guessCategory } from '../lib/categories';
import { formatMoney, formatDate } from '../lib/format';
import { useToast } from '../context/ToastContext';

const MAX_ROWS = 2000;

/**
 * Import a bank statement exported as CSV (FNB, Capitec, Standard Bank, Absa, Nedbank, Discovery and most others).
 * Steps: choose file -> confirm columns -> review rows (category + include) -> import.
 */
const ImportStatementModal = ({ open, onClose, data, currency }) => {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [step, setStep] = useState('file');
  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState({ header: [], body: [] });
  const [cols, setCols] = useState({ date: -1, description: -1, amount: -1, debit: -1, credit: -1 });
  const [dayFirst, setDayFirst] = useState(true);
  const [outIsNegative, setOutIsNegative] = useState(true);
  const [includeIncome, setIncludeIncome] = useState(true);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const expenseNames = data.expenseCategories.map((c) => c.name);
  const incomeNames = data.incomeCategories.map((c) => c.name);

  const reset = () => {
    setStep('file'); setFileName(''); setTable({ header: [], body: [] }); setRows([]);
    if (fileRef.current) fileRef.current.value = '';
  };
  const close = () => { reset(); onClose(); };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      toast({ tone: 'error', message: 'Please choose a .csv file. Most banks offer “Download as CSV” in online banking.' });
      return;
    }
    const text = await file.text();
    const parsed = parseCSV(text);
    const h = findHeaderRow(parsed);
    const header = parsed[h] || [];
    const body = parsed.slice(h + 1).slice(0, MAX_ROWS);
    if (!body.length) {
      toast({ tone: 'error', message: 'We couldn’t find any transactions in that file.' });
      return;
    }
    setFileName(file.name);
    setTable({ header, body });
    setCols(guessColumns(header));
    setStep('columns');
  };

  // Existing entries, used to flag likely duplicates
  const existingKeys = useMemo(() => {
    const s = new Set();
    data.expenses.forEach((x) => s.add(`e|${x.occurred_on}|${Number(x.amount).toFixed(2)}`));
    data.income.forEach((x) => s.add(`i|${x.occurred_on}|${Number(x.amount).toFixed(2)}`));
    return s;
  }, [data.expenses, data.income]);

  const buildRows = () => {
    const out = [];
    table.body.forEach((r, idx) => {
      const date = parseBankDate(r[cols.date], dayFirst);
      const description = (r[cols.description] || '').replace(/\s+/g, ' ').trim();
      let signed = null;
      if (cols.amount >= 0) {
        const a = parseAmount(r[cols.amount]);
        if (a !== null) signed = outIsNegative ? a : -a;
      } else {
        const debit = parseAmount(r[cols.debit]);
        const credit = parseAmount(r[cols.credit]);
        if (debit) signed = -Math.abs(debit);
        else if (credit) signed = Math.abs(credit);
      }
      if (!date || signed === null || signed === 0) return;
      const isIncome = signed > 0;
      if (isIncome && !includeIncome) return;
      const amount = Math.abs(signed);
      const kind = isIncome ? 'income' : 'expense';
      const dupe = existingKeys.has(`${isIncome ? 'i' : 'e'}|${date}|${amount.toFixed(2)}`);
      out.push({
        key: idx,
        kind,
        date,
        name: description || (isIncome ? 'Deposit' : 'Card purchase'),
        amount,
        category: isIncome ? guessIncome(description) : guessCategory(description, expenseNames),
        include: !dupe,
        dupe,
      });
    });
    if (!out.length) {
      toast({ tone: 'error', message: 'No rows matched those columns. Check the date and amount columns.' });
      return;
    }
    setRows(out);
    setStep('review');
  };

  const guessIncome = (d) => {
    const t = (d || '').toLowerCase();
    if (/salary|payroll|wage/.test(t) && incomeNames.includes('Salary')) return 'Salary';
    if (/interest|dividend/.test(t) && incomeNames.includes('Investment')) return 'Investment';
    return incomeNames.includes('Other') ? 'Other' : incomeNames[0];
  };

  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const selected = rows.filter((r) => r.include);

  const doImport = async () => {
    setBusy(true);
    const exp = selected.filter((r) => r.kind === 'expense').map((r) => ({ name: r.name.slice(0, 120), amount: r.amount, category: r.category, occurred_on: r.date, isRecurring: false }));
    const inc = selected.filter((r) => r.kind === 'income').map((r) => ({ source: r.name.slice(0, 120), amount: r.amount, category: r.category, occurred_on: r.date, is_recurring: false }));
    const a = await data.insertRows('expenses', exp);
    const b = a ? await data.insertRows('income', inc) : null;
    setBusy(false);
    if (a && b) {
      toast({ message: `Imported ${exp.length} expense${exp.length === 1 ? '' : 's'}${inc.length ? ` and ${inc.length} income entr${inc.length === 1 ? 'y' : 'ies'}` : ''}` });
      close();
    }
  };

  const colSelect = (key, label, optional) => (
    <div>
      <label className="label" htmlFor={`col-${key}`}>{label}</label>
      <select id={`col-${key}`} className="input" value={cols[key]} onChange={(e) => setCols((c) => ({ ...c, [key]: Number(e.target.value) }))}>
        <option value={-1}>{optional ? '(none)' : 'Choose a column'}</option>
        {table.header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}{table.body[0]?.[i] ? `  e.g. ${String(table.body[0][i]).slice(0, 24)}` : ''}</option>)}
      </select>
    </div>
  );

  const columnsReady = cols.date >= 0 && cols.description >= 0 && (cols.amount >= 0 || cols.debit >= 0 || cols.credit >= 0);

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import a bank statement"
      subtitle={step === 'file' ? 'Upload the CSV file from your online banking.' : fileName}
      size={step === 'review' ? 'xl' : 'lg'}
      footer={
        step === 'columns' ? (
          <>
            <button className="btn-ghost" onClick={reset}>Back</button>
            <button className="btn-primary" onClick={buildRows} disabled={!columnsReady}>Preview transactions</button>
          </>
        ) : step === 'review' ? (
          <>
            <button className="btn-ghost" onClick={() => setStep('columns')}>Back</button>
            <button className="btn-primary" onClick={doImport} disabled={busy || !selected.length}>
              {busy && <Loader2 size={16} className="animate-spin" />}Import {selected.length} transaction{selected.length === 1 ? '' : 's'}
            </button>
          </>
        ) : null
      }
    >
      {step === 'file' && (
        <>
          <button onClick={() => fileRef.current?.click()} className="w-full min-h-[160px] rounded-2xl border-2 border-dashed border-obsidian-600 hover:border-gold-500 flex flex-col items-center justify-center gap-3 p-6 transition-colors">
            <FileUp size={32} className="text-gold-500" />
            <span className="font-medium text-platinum-200">Choose a CSV file</span>
            <span className="text-sm text-platinum-500 text-center max-w-sm">Your file is read on this device. Only the transactions you choose are saved.</span>
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={onFile} />
          <p className="hint mt-4">Tip: in your banking app, open your account, then look for “Download statement” or “Export” and pick CSV. PDF import is coming later.</p>
        </>
      )}

      {step === 'columns' && (
        <div className="space-y-4">
          <p className="text-platinum-300">We’ve matched the columns we could. Check they look right.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {colSelect('date', 'Date')}
            {colSelect('description', 'Description')}
            {colSelect('amount', 'Amount (one column)', true)}
            <div className="grid grid-cols-2 gap-2">
              {colSelect('debit', 'Money out', true)}
              {colSelect('credit', 'Money in', true)}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="date-fmt">Dates are written</label>
              <select id="date-fmt" className="input" value={dayFirst ? 'dmy' : 'mdy'} onChange={(e) => setDayFirst(e.target.value === 'dmy')}>
                <option value="dmy">Day first (31/01/2026)</option>
                <option value="mdy">Month first (01/31/2026)</option>
              </select>
            </div>
            {cols.amount >= 0 && (
              <div>
                <label className="label" htmlFor="sign">Money out is shown as</label>
                <select id="sign" className="input" value={outIsNegative ? 'neg' : 'pos'} onChange={(e) => setOutIsNegative(e.target.value === 'neg')}>
                  <option value="neg">Negative numbers (−150.00)</option>
                  <option value="pos">Positive numbers (150.00)</option>
                </select>
              </div>
            )}
          </div>
          <label className="flex items-center gap-3 text-platinum-200 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-gold-500" checked={includeIncome} onChange={(e) => setIncludeIncome(e.target.checked)} />
            Also import money coming in as income
          </label>
        </div>
      )}

      {step === 'review' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-platinum-300 text-sm">
              {rows.length} transactions found · {selected.length} selected · total out {formatMoney(selected.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.amount, 0), currency)}
            </p>
            <div className="flex gap-2">
              <button className="btn-ghost !py-1.5 !px-3" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, include: true })))}>Select all</button>
              <button className="btn-ghost !py-1.5 !px-3" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, include: false })))}>Select none</button>
            </div>
          </div>
          {rows.some((r) => r.dupe) && (
            <p className="flex items-center gap-2 text-sm text-gold-500 mb-3"><AlertTriangle size={16} /> Rows marked “Already added?” match an existing entry and are unticked.</p>
          )}
          <div className="overflow-x-auto -mx-5 sm:mx-0">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-platinum-500 border-b border-obsidian-700">
                  <th className="py-2 pl-5 sm:pl-2 w-8"><span className="sr-only">Include</span></th>
                  <th className="py-2 px-2">Date</th>
                  <th className="py-2 px-2">Description</th>
                  <th className="py-2 px-2">Category</th>
                  <th className="py-2 px-2 text-right pr-5 sm:pr-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className={`border-b border-obsidian-700/50 ${r.include ? '' : 'opacity-50'}`}>
                    <td className="py-2 pl-5 sm:pl-2"><input type="checkbox" className="w-4 h-4 accent-gold-500" checked={r.include} onChange={(e) => setRow(r.key, { include: e.target.checked })} aria-label={`Include ${r.name}`} /></td>
                    <td className="py-2 px-2 whitespace-nowrap text-platinum-300">{formatDate(r.date, { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                    <td className="py-2 px-2 text-platinum-100 max-w-[240px]">
                      <span className="block truncate" title={r.name}>{r.name}</span>
                      {r.dupe && <span className="badge bg-gold-500/10 text-gold-500 mt-0.5">Already added?</span>}
                    </td>
                    <td className="py-2 px-2">
                      <select className="input !py-1.5 !text-sm" value={r.category} onChange={(e) => setRow(r.key, { category: e.target.value })} aria-label={`Category for ${r.name}`}>
                        {(r.kind === 'income' ? incomeNames : expenseNames).map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                    <td className={`py-2 px-2 pr-5 sm:pr-2 text-right tabular-nums whitespace-nowrap ${r.kind === 'income' ? 'text-emerald-500' : 'text-white'}`}>
                      {r.kind === 'income' ? '+' : ''}{formatMoney(r.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ImportStatementModal;
