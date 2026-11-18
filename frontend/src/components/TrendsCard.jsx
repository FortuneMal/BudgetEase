import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { monthlySeries, categoryChanges } from '../lib/insights';
import { formatMoney, MONTHS } from '../lib/format';

const TrendsCard = ({ data, year, month, currency }) => {
  const series = useMemo(() => monthlySeries(data, year, month, 6), [data, year, month]);
  const changes = useMemo(() => categoryChanges(data, year, month).slice(0, 4), [data, year, month]);
  const hasData = series.some((s) => s.Income || s.Spending);
  const prevMonth = MONTHS[(month + 11) % 12];

  const tooltip = ({ active, payload, label }) =>
    active && payload?.length ? (
      <div className="rounded-xl border border-obsidian-600 bg-obsidian-900/95 px-4 py-3 shadow-xl text-sm">
        <p className="font-semibold text-white mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey} className="flex items-center gap-2 text-platinum-300">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} /> {p.dataKey}: <span className="text-white tabular-nums">{formatMoney(p.value, currency)}</span>
          </p>
        ))}
      </div>
    ) : null;

  return (
    <div className="card">
      <h2 className="card-title mb-1">Last 6 months</h2>
      <p className="text-platinum-400 mb-5">Income compared with spending.</p>
      {hasData ? (
        <div className="h-64 -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} width={60} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
              <Tooltip content={tooltip} cursor={{ fill: 'rgba(212,175,55,0.06)' }} />
              <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
              <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="Spending" fill="#d4af37" radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-platinum-500 py-10 text-center">Your trend will appear once you’ve added a few entries.</p>
      )}

      {changes.length > 0 && (
        <div className="mt-6 border-t border-obsidian-700 pt-5">
          <h3 className="font-semibold text-platinum-200 mb-3">Biggest changes vs {prevMonth}</h3>
          <ul className="space-y-2">
            {changes.map((c) => {
              const up = c.diff > 0;
              const Icon = up ? ArrowUpRight : ArrowDownRight;
              return (
                <li key={c.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-platinum-200">
                    <Icon size={16} className={up ? 'text-red-400' : 'text-emerald-500'} />
                    {c.name}
                  </span>
                  <span className="text-platinum-400 text-right">
                    <span className={up ? 'text-red-400' : 'text-emerald-500'}>
                      {up ? '+' : '−'}{formatMoney(Math.abs(c.diff), currency)}
                    </span>
                    {c.pct !== null && <span> ({up ? 'up' : 'down'} {Math.abs(Math.round(c.pct))}%)</span>}
                    {c.pct === null && <span> (new)</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TrendsCard;
