import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { formatMoney } from '../lib/format';

const COLORS = ['#d4af37', '#10b981', '#6366f1', '#f97316', '#0ea5e9', '#ec4899', '#a3a3a3', '#84cc16', '#eab308', '#14b8a6'];

// Where the money went this month: spent vs budget per category, or share of total.
const RechartsSpendingChart = ({ byCategory, categories, currency }) => {
  const [chartType, setChartType] = useState('pie');

  const data = Object.entries(byCategory)
    .map(([name, spent]) => ({ name, Spent: spent, Budget: Number(categories.find((c) => c.name === name)?.budget) || 0 }))
    .sort((a, b) => b.Spent - a.Spent);

  const tooltip = ({ active, payload, label }) =>
    active && payload?.length ? (
      <div className="rounded-xl border border-obsidian-600 bg-obsidian-900/95 px-4 py-3 shadow-xl text-sm">
        <p className="font-semibold text-white mb-1">{label || payload[0].name}</p>
        {payload.map((p) => (
          <p key={p.dataKey} className="text-platinum-300">{p.dataKey}: <span className="text-white tabular-nums">{formatMoney(p.value, currency)}</span></p>
        ))}
      </div>
    ) : null;

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="card-title">Where it went</h2>
        <div className="segmented" role="group" aria-label="Chart type">
          <button aria-pressed={chartType === 'pie'} onClick={() => setChartType('pie')}>Share</button>
          <button aria-pressed={chartType === 'bar'} onClick={() => setChartType('bar')}>vs budget</button>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-platinum-500 py-10 text-center">Add some spending to see the breakdown.</p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={data} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                <Tooltip content={tooltip} cursor={{ fill: 'rgba(212,175,55,0.06)' }} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="Budget" fill="#64748b" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="Spent" fill="#d4af37" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            ) : (
              <PieChart>
                <Pie data={data} dataKey="Spent" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3} stroke="none">
                  {data.map((d, i) => <Cell key={d.name} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={tooltip} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default RechartsSpendingChart;
