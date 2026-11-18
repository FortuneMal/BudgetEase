import React, { useEffect, useRef, useState } from 'react';
import { Wand2, Camera, PenLine, Loader2, Sparkles } from 'lucide-react';
import Modal from './ui/Modal';
import ExpenseFields from './ExpenseFields';
import { supabase } from '../utils/supabase';
import { apiPost } from '../lib/api';
import { friendlyError } from '../lib/errors';
import { todayISO } from '../lib/format';
import { useToast } from '../context/ToastContext';

const MAX_RECEIPT_MB = 8;

/**
 * Add or edit an expense.
 *  - describe: type a sentence, AI fills the form, you review, then save
 *  - scan:     photo of a receipt, AI fills the form, you review, then save (receipt stays attached)
 *  - manual:   just the form
 * Pass `expense` to edit an existing one.
 */
const ExpenseModal = ({ open, onClose, startMode = 'describe', expense, defaults = {}, categories, currency, userId, onAdd, onUpdate }) => {
  const { toast } = useToast();
  const isEdit = Boolean(expense);
  const fallbackCategory = categories.find((c) => c.name === 'Other')?.name || categories[0]?.name || 'Other';

  const blank = () => ({
    name: '',
    amount: '',
    category: defaults.category || fallbackCategory,
    occurred_on: defaults.occurred_on || todayISO(),
    isRecurring: Boolean(defaults.isRecurring),
    receipt_path: null,
  });

  const [mode, setMode] = useState(startMode);
  const [step, setStep] = useState('input'); // input | review
  const [form, setForm] = useState(blank);
  const [sentence, setSentence] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiNote, setAiNote] = useState(null);
  const fileRef = useRef(null);
  const uploadedPath = useRef(null); // receipt uploaded during this session, removed if discarded

  useEffect(() => {
    if (!open) return;
    uploadedPath.current = null;
    setAiNote(null);
    setSentence('');
    setBusy(false);
    if (isEdit) {
      setMode('manual');
      setStep('review');
      setForm({
        name: expense.name,
        amount: String(expense.amount),
        category: expense.category,
        occurred_on: expense.occurred_on,
        isRecurring: Boolean(expense.isRecurring),
        receipt_path: expense.receipt_path || null,
      });
    } else {
      setMode(startMode);
      setStep(startMode === 'manual' ? 'review' : 'input');
      setForm(blank());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const names = categories.map((c) => c.name);
  const pickCategory = (c) => (names.includes(c) ? c : fallbackCategory);

  const close = (saved = false) => {
    if (!saved && uploadedPath.current) {
      supabase.storage.from('receipts').remove([uploadedPath.current]).catch(() => {});
    }
    uploadedPath.current = null;
    onClose();
  };

  const switchMode = (m) => {
    setMode(m);
    setAiNote(null);
    setStep(m === 'manual' ? 'review' : 'input');
  };

  const handleDescribe = async (e) => {
    e.preventDefault();
    if (!sentence.trim()) return;
    setBusy(true);
    try {
      const d = await apiPost('/api/ai/categorize', {
        natural_language_input: sentence.trim(),
        categories: names,
        currency,
        today: todayISO(),
      });
      setForm({
        ...blank(),
        name: d.merchant || sentence.trim().slice(0, 60),
        amount: d.amount ? String(d.amount) : '',
        category: pickCategory(d.category),
        occurred_on: /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : blank().occurred_on,
        isRecurring: Boolean(d.isRecurring),
      });
      setAiNote('Check these details, then save.');
      setStep('review');
    } catch (err) {
      toast({ tone: 'error', message: friendlyError(err) });
      setForm({ ...blank(), name: sentence.trim().slice(0, 60) });
      setAiNote('We couldn’t read that automatically. Fill in the rest below.');
      setStep('review');
    } finally {
      setBusy(false);
    }
  };

  const handleReceipt = async (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ tone: 'error', message: 'Please choose a photo (JPG or PNG) of the receipt.' });
      return;
    }
    if (file.size > MAX_RECEIPT_MB * 1024 * 1024) {
      toast({ tone: 'error', message: `That photo is over ${MAX_RECEIPT_MB} MB. Try a smaller one.` });
      return;
    }

    setBusy(true);
    let path = null;
    try {
      const safeName = file.name.replace(/[^\w.-]/g, '_').slice(-60);
      path = `${userId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      uploadedPath.current = path;

      const { data: signed, error: signErr } = await supabase.storage.from('receipts').createSignedUrl(path, 300);
      if (signErr) throw signErr;

      let d = {};
      try {
        d = await apiPost('/api/ai/parse-receipt', { storage_url: signed.signedUrl, categories: names });
        setAiNote('We read your receipt. Check the details, then save.');
      } catch (aiErr) {
        console.error(aiErr);
        setAiNote('Receipt saved, but we couldn’t read it automatically. Fill in the details below.');
      }
      setForm({
        ...blank(),
        name: d.merchant || '',
        amount: d.amount ? String(d.amount) : '',
        category: pickCategory(d.category),
        occurred_on: /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : todayISO(),
        receipt_path: path,
      });
      setStep('review');
    } catch (err) {
      toast({ tone: 'error', message: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  };

  const save = async (e) => {
    e?.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.name.trim() || !(amount > 0)) {
      toast({ tone: 'error', message: 'Add a description and an amount above zero.' });
      return;
    }
    setBusy(true);
    const payload = { ...form, amount };
    let ok;
    if (isEdit) {
      ok = await onUpdate(expense.id, {
        name: payload.name.trim(),
        amount,
        category: payload.category,
        occurred_on: payload.occurred_on,
        isRecurring: payload.isRecurring,
        receipt_path: payload.receipt_path,
      });
    } else {
      ok = await onAdd(payload);
    }
    setBusy(false);
    if (ok) {
      toast({ message: isEdit ? 'Changes saved' : `Added “${payload.name.trim()}”` });
      close(true);
    }
  };

  const tabs = [
    { id: 'describe', label: 'Describe it', icon: Wand2 },
    { id: 'scan', label: 'Scan receipt', icon: Camera },
    { id: 'manual', label: 'Type it in', icon: PenLine },
  ];

  return (
    <Modal
      open={open}
      onClose={() => close(false)}
      title={isEdit ? 'Edit expense' : 'Add an expense'}
      footer={step === 'review' ? (
        <>
          <button className="btn-ghost" onClick={() => close(false)} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {isEdit ? 'Save changes' : 'Save expense'}
          </button>
        </>
      ) : null}
    >
      {!isEdit && (
        <div className="segmented w-full mb-5" role="group" aria-label="How do you want to add it?">
          {tabs.map((t) => (
            <button key={t.id} type="button" aria-pressed={mode === t.id} onClick={() => switchMode(t.id)} className="flex-1 flex items-center justify-center gap-2">
              <t.icon size={16} /> <span className="hidden sm:inline">{t.label}</span><span className="sm:hidden">{t.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}

      {step === 'input' && mode === 'describe' && (
        <form onSubmit={handleDescribe} className="space-y-4">
          <div>
            <label className="label" htmlFor="describe">Describe what you spent</label>
            <textarea
              id="describe"
              className="input min-h-[96px] resize-none"
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              placeholder={'e.g. "Lunch at Nando’s 145 yesterday" or "Netflix 199 every month"'}
              autoFocus
              maxLength={300}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleDescribe(e); }}
            />
            <p className="hint">We’ll fill in the details. You check them before anything is saved.</p>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy || !sentence.trim()}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {busy ? 'Reading…' : 'Fill in the details'}
          </button>
        </form>
      )}

      {step === 'input' && mode === 'scan' && (
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="w-full min-h-[180px] rounded-2xl border-2 border-dashed border-obsidian-600 hover:border-gold-500 bg-obsidian-900/40 flex flex-col items-center justify-center gap-3 p-6 transition-colors"
          >
            {busy ? (
              <>
                <Loader2 size={32} className="animate-spin text-gold-500" />
                <span className="text-platinum-300">Reading your receipt…</span>
              </>
            ) : (
              <>
                <Camera size={32} className="text-gold-500" />
                <span className="text-base font-medium text-platinum-200">Take a photo or choose one</span>
                <span className="text-sm text-platinum-500">JPG or PNG, up to {MAX_RECEIPT_MB} MB. Only you can see it.</span>
              </>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceipt} />
        </div>
      )}

      {step === 'review' && (
        <form onSubmit={save}>
          {aiNote && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-gold-500/30 bg-gold-500/5 p-3 text-sm text-platinum-200">
              <Sparkles size={16} className="text-gold-500 mt-0.5 shrink-0" /> {aiNote}
            </div>
          )}
          <ExpenseFields value={form} onChange={setForm} categories={categories} currency={currency} autoFocus={mode === 'manual' && !isEdit} isExisting={isEdit} />
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      )}
    </Modal>
  );
};

export default ExpenseModal;
