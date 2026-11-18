import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Send, Loader2, TrendingUp, TrendingDown, Minus, MessageCircle } from 'lucide-react';
import { advisorSnapshot, localInsights } from '../lib/insights';
import { apiPost } from '../lib/api';
import { monthLabel } from '../lib/format';

const SUGGESTIONS = [
  'How am I doing this month?',
  'Where can I cut back?',
  'Can I afford a 4,000 trip next month?',
  'How long until I reach my goals?',
];

const toneIcon = { good: TrendingUp, bad: TrendingDown, neutral: Minus };
const toneColor = { good: 'text-emerald-500', bad: 'text-red-400', neutral: 'text-gold-500' };

// Advisor: plain-language insights from your own numbers, plus a chat you can ask anything.
const AdvisorTab = ({ data, year, month, currency }) => {
  const insights = useMemo(() => localInsights(data, year, month, currency), [data, year, month, currency]);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, busy]);

  const ask = async (text) => {
    const q = text.trim();
    if (!q || busy) return;
    const history = [...messages, { role: 'user', content: q }];
    setMessages(history);
    setQuestion('');
    setBusy(true);
    try {
      const res = await apiPost('/api/ai/advise', {
        question: q,
        snapshot: advisorSnapshot(data, year, month, currency),
        history: history.slice(-8, -1),
      });
      setMessages((m) => [...m, { role: 'assistant', content: res.answer }]);
    } catch {
      setMessages((m) => [...m, {
        role: 'assistant',
        error: true,
        content: 'The advisor is offline right now. In the meantime, the insights above are worked out from your own numbers.',
      }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card">
        <h2 className="card-title flex items-center gap-2"><Sparkles size={22} className="text-gold-500" /> Your month at a glance</h2>
        <p className="text-platinum-400 mt-1 mb-5">Based on what you’ve recorded for {monthLabel(year, month)}.</p>
        <ul className="space-y-3">
          {insights.map((i, idx) => {
            const Icon = toneIcon[i.tone];
            return (
              <li key={idx} className="flex items-start gap-3 rounded-xl bg-obsidian-900/50 border border-obsidian-700 p-4">
                <Icon size={18} className={`${toneColor[i.tone]} mt-0.5 shrink-0`} />
                <p className="text-platinum-200 leading-relaxed">{i.text}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="card">
        <h2 className="card-title flex items-center gap-2"><MessageCircle size={22} className="text-gold-500" /> Ask the advisor</h2>
        <p className="text-platinum-400 mt-1 mb-5">Ask about your money in your own words. Answers use your real numbers.</p>

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-full border border-obsidian-600 px-4 py-2 text-sm text-platinum-300 hover:border-gold-500/60 hover:text-white transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.length > 0 && (
          <div className="space-y-3 mb-4 max-h-[50vh] overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-gold-500/15 border border-gold-500/30 text-platinum-100'
                    : m.error ? 'bg-red-500/10 border border-red-500/30 text-platinum-200' : 'bg-obsidian-900/60 border border-obsidian-700 text-platinum-200'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-platinum-400 text-sm"><Loader2 size={16} className="animate-spin" /> Thinking…</div>
            )}
            <div ref={endRef} />
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); ask(question); }} className="flex gap-2">
          <input className="input" placeholder="e.g. Can I afford a new phone in March?" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={400} aria-label="Ask a question" />
          <button type="submit" className="btn-primary shrink-0 !px-4" disabled={busy || !question.trim()} aria-label="Send"><Send size={16} /></button>
        </form>
        <p className="hint">General guidance, not regulated financial advice.</p>
      </div>
    </div>
  );
};

export default AdvisorTab;
