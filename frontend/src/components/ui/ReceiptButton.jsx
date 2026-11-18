import React, { useState } from 'react';
import { Paperclip, Loader2 } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useToast } from '../../context/ToastContext';
import { friendlyError } from '../../lib/errors';

// Opens a privately stored receipt using a short-lived signed link.
const ReceiptButton = ({ path, label = false }) => {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  if (!path) return null;

  const open = async (e) => {
    e.stopPropagation();
    setBusy(true);
    // Open the tab synchronously so popup blockers allow it, then point it at the signed URL.
    const win = window.open('', '_blank');
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 120);
    setBusy(false);
    if (error || !data?.signedUrl) {
      win?.close();
      toast({ tone: 'error', message: friendlyError(error || 'Receipt not found') });
      return;
    }
    if (win) win.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  };

  return (
    <button type="button" onClick={open} className={label ? 'btn-ghost !py-2' : 'icon-btn'} title="View receipt" aria-label="View receipt">
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
      {label && <span>View receipt</span>}
    </button>
  );
};

export default ReceiptButton;
