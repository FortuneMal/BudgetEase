import React, { useEffect, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { CURRENCIES, formatMoney } from '../lib/format';

export const fetchRate = async (from, to) => {
  const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
  const data = await res.json();
  if (data.result !== 'success' || !data.rates?.[to]) throw new Error('Exchange rate unavailable');
  return data.rates[to];
};

// Quick converter for travel or foreign purchases.
const CurrencyConverter = ({ baseCurrency = 'USD' }) => {
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState(baseCurrency === 'USD' ? 'EUR' : 'USD');
  const [to, setTo] = useState(baseCurrency);
  const [rate, setRate] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchRate(from, to)
      .then((r) => !cancelled && setRate(r))
      .catch(() => !cancelled && setError('Exchange rates are unavailable right now.'));
    return () => { cancelled = true; };
  }, [from, to]);

  const n = parseFloat(amount) || 0;

  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div>
          <label className="label" htmlFor="cc-amount">Amount</label>
          <div className="flex gap-2">
            <input id="cc-amount" className="input" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <select className="input !w-24" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From currency">
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <button className="icon-btn mb-1.5" onClick={() => { setFrom(to); setTo(from); }} aria-label="Swap currencies"><ArrowRightLeft size={18} /></button>
        <div>
          <label className="label" htmlFor="cc-to">To</label>
          <select id="cc-to" className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-obsidian-900/50 border border-obsidian-700 p-4 text-center">
        {error ? <p className="text-red-400 text-sm">{error}</p> : rate ? (
          <>
            <p className="text-2xl font-semibold text-white tabular-nums">{formatMoney(n * rate, to)}</p>
            <p className="text-sm text-platinum-500 mt-1">1 {from} = {rate.toFixed(4)} {to}</p>
          </>
        ) : <p className="text-platinum-500 text-sm">Loading rate…</p>}
      </div>
    </div>
  );
};

export default CurrencyConverter;
