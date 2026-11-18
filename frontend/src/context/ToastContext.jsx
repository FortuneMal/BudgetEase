import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let nextId = 1;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  /**
   * toast({ message, tone: 'success'|'error'|'info', action: { label, onClick }, duration, onExpire })
   * onExpire runs when the toast times out (not when its action is clicked or it is closed early).
   */
  const toast = useCallback((opts) => {
    const id = nextId++;
    const t = { tone: 'success', duration: opts.action ? 6000 : 4000, ...opts, id };
    setToasts((prev) => [...prev.slice(-3), t]);
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        setToasts((prev) => prev.filter((x) => x.id !== id));
        t.onExpire?.();
      }, t.duration)
    );
    return id;
  }, []);

  const runAction = (t) => {
    dismiss(t.id);
    t.action?.onClick();
  };

  const closeEarly = (t) => {
    dismiss(t.id);
    t.onExpire?.();
  };

  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="fixed z-[100] bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md space-y-2 pointer-events-none" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = icons[t.tone] || Info;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.97 }}
                className="pointer-events-auto flex items-center gap-3 rounded-xl border border-obsidian-600 bg-obsidian-800/95 backdrop-blur-xl px-4 py-3 shadow-2xl"
                role={t.tone === 'error' ? 'alert' : 'status'}
              >
                <Icon size={18} className={t.tone === 'error' ? 'text-red-400 shrink-0' : 'text-gold-500 shrink-0'} />
                <p className="flex-1 text-sm text-platinum-200">{t.message}</p>
                {t.action && (
                  <button onClick={() => runAction(t)} className="text-sm font-semibold text-gold-500 hover:text-gold-400 px-2 py-1">
                    {t.action.label}
                  </button>
                )}
                <button onClick={() => closeEarly(t)} className="p-1 text-platinum-500 hover:text-platinum-200" aria-label="Dismiss">
                  <X size={16} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
