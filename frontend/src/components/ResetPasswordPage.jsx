import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import { friendlyError } from '../lib/errors';
import AuthLayout, { Spinner, Notice } from './AuthLayout';

// Shown after the user opens the password reset link from their email.
const ResetPasswordPage = ({ onDone }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('The two passwords don’t match.'); return; }
    setError('');
    setLoading(true);
    const { error: sbError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (sbError) setError(friendlyError(sbError));
    else onDone();
  };

  return (
    <AuthLayout title="Choose a new password">
      {error && <Notice>{error}</Notice>}
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="label" htmlFor="pw">New password</label>
          <input className="input" id="pw" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="pw2">Type it again</label>
          <input className="input" id="pw2" type="password" autoComplete="new-password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <button className="btn-primary w-full !py-3.5" type="submit" disabled={loading}>{loading ? <Spinner /> : 'Save password'}</button>
      </form>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
