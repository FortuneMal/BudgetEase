import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import { friendlyError } from '../lib/errors';
import AuthLayout, { Spinner, Notice } from './AuthLayout';

const LoginPage = ({ onNavigate }) => {
  const [mode, setMode] = useState('signin'); // signin | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: sbError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (sbError) setError(friendlyError(sbError));
    // On success, App's auth listener switches to the dashboard.
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: sbError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setLoading(false);
    if (sbError) setError(friendlyError(sbError));
    else setInfo(`If there’s an account for ${email.trim()}, we’ve sent a link to reset the password. Check your inbox.`);
  };

  if (mode === 'forgot') {
    return (
      <AuthLayout
        title="Reset your password"
        subtitle="We’ll email you a link to choose a new one."
        footer={<button className="font-semibold text-gold-500 hover:text-gold-400" onClick={() => { setMode('signin'); setInfo(''); setError(''); }}>Back to sign in</button>}
      >
        {error && <Notice>{error}</Notice>}
        {info && <Notice tone="success">{info}</Notice>}
        <form onSubmit={handleReset} className="space-y-5">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <button className="btn-primary w-full !py-3.5" type="submit" disabled={loading}>{loading ? <Spinner /> : 'Send reset link'}</button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to see where your money is going."
      footer={<>New to BudgetEase?{' '}<button onClick={() => onNavigate('register')} className="font-semibold text-gold-500 hover:text-gold-400">Create an account</button></>}
    >
      {error && <Notice>{error}</Notice>}
      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label !mb-0" htmlFor="password">Password</label>
            <button type="button" className="text-sm font-medium text-gold-500 hover:text-gold-400" onClick={() => { setMode('forgot'); setError(''); }}>Forgot password?</button>
          </div>
          <input className="input" id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn-primary w-full !py-3.5" type="submit" disabled={loading}>{loading ? <Spinner /> : 'Sign in'}</button>
      </form>
    </AuthLayout>
  );
};

export default LoginPage;
