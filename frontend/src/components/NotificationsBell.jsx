import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, AlertTriangle, AlertCircle, CalendarClock, CheckCircle2 } from 'lucide-react';
import { computeAlerts } from '../lib/insights';

const SEEN_KEY = 'budgetease_seen_alerts';
const readSeen = () => {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); }
};

const toneStyle = {
  danger: { icon: AlertCircle, cls: 'text-red-400' },
  warning: { icon: AlertTriangle, cls: 'text-gold-500' },
  info: { icon: CalendarClock, cls: 'text-sky-400' },
};

const NotificationsBell = ({ data, currency, onNavigate }) => {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const ref = useRef(null);
  const alerts = useMemo(() => computeAlerts(data, currency), [data, currency]);
  const unseen = alerts.filter((a) => !seen.has(a.id)).length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unseen) {
      // Remember only current alert ids so the list doesn't grow forever
      const ids = alerts.map((a) => a.id);
      try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)); } catch { /* storage unavailable */ }
      setTimeout(() => setSeen(new Set(ids)), 1500);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative p-2 rounded-xl border border-obsidian-700 bg-obsidian-800/50 text-platinum-300 hover:text-gold-400 hover:border-gold-500/50 transition-colors" aria-label={`Alerts${unseen ? `, ${unseen} new` : ''}`} aria-expanded={open}>
        <Bell size={18} />
        {unseen > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">{unseen}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-obsidian-600 bg-obsidian-800 shadow-2xl z-[60] overflow-hidden">
          <div className="px-4 py-3 border-b border-obsidian-700 font-semibold text-white">Alerts</div>
          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <CheckCircle2 size={28} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-platinum-300">All good. Nothing needs your attention.</p>
            </div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-obsidian-700">
              {alerts.map((a) => {
                const { icon: Icon, cls } = toneStyle[a.tone];
                return (
                  <li key={a.id}>
                    <button className="w-full text-left flex gap-3 px-4 py-3 hover:bg-obsidian-700/40" onClick={() => { setOpen(false); onNavigate(a.tab); }}>
                      <Icon size={18} className={`${cls} mt-0.5 shrink-0`} />
                      <span>
                        <span className="block font-medium text-platinum-100">{a.title}{!seen.has(a.id) && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-red-500 align-middle" />}</span>
                        <span className="block text-sm text-platinum-400 mt-0.5">{a.body}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsBell;
