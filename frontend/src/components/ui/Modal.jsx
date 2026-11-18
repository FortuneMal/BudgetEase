import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Centered dialog on desktop, bottom sheet on phones.
 */
const Modal = ({ open, onClose, title, subtitle, children, footer, size = 'md' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`relative w-full ${widths[size]} max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-obsidian-600 bg-obsidian-800 shadow-2xl`}
          >
            <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-obsidian-700">
              <div>
                <h2 className="text-xl font-serif text-white">{title}</h2>
                {subtitle && <p className="text-sm text-platinum-400 mt-1">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="p-2 -m-2 rounded-lg text-platinum-400 hover:text-white hover:bg-obsidian-700" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="px-5 sm:px-6 py-5 overflow-y-auto">{children}</div>
            {footer && <div className="px-5 sm:px-6 py-4 border-t border-obsidian-700 flex flex-wrap justify-end gap-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default Modal;
