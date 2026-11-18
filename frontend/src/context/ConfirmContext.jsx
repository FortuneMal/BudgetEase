import React, { createContext, useCallback, useContext, useState } from 'react';
import Modal from '../components/ui/Modal';

const ConfirmContext = createContext(null);

/**
 * const confirm = useConfirm();
 * const ok = await confirm({ title, message, confirmLabel, tone: 'danger' });          // -> true | false
 * const choice = await confirm({ title, message, choices: [{ value, label, tone }] });  // -> value | null
 */
export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null);

  const confirm = useCallback(
    (opts) => new Promise((resolve) => setState({ ...opts, resolve })),
    []
  );

  const close = (value) => {
    state?.resolve(value);
    setState(null);
  };

  const choices = state?.choices || [
    { value: true, label: state?.confirmLabel || 'Confirm', tone: state?.tone || 'primary' },
  ];
  const cancelValue = state?.choices ? null : false;

  const btnClass = (tone) =>
    tone === 'danger' ? 'btn-danger' : tone === 'secondary' ? 'btn-secondary' : 'btn-primary';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(state)}
        onClose={() => close(cancelValue)}
        title={state?.title || 'Are you sure?'}
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => close(cancelValue)}>Cancel</button>
            {choices.map((c) => (
              <button key={String(c.value)} className={btnClass(c.tone)} onClick={() => close(c.value)}>
                {c.label}
              </button>
            ))}
          </>
        }
      >
        <p className="text-platinum-300 leading-relaxed">{state?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => useContext(ConfirmContext);
