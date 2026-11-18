import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import { friendlyError } from '../lib/errors';
import { CURRENCIES } from '../lib/format';
import AuthLayout, { Spinner, Notice } from './AuthLayout';

// Guess a sensible default currency from the browser's region.
const guessCurrency = () => {
  const region = (navigator.language || '').split('-')[1];
  const map = { ZA: 'ZAR', US: 'USD', GB: 'GBP', AU: 'AUD', CA: 'CAD', JP: 'JPY', DE: 'EUR', FR: 'EUR', IE: 'EUR', NL: 'EUR', ES: 'EUR', IT: 'EUR' };
  return map[region] || 'USD';
};

const RegisterPage = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [currency, setCurrency] = useState(guessCurrency);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: sbError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim(), currency }, emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (sbError) { setError(friendlyError(sbError)); return; }
    // With email confirmation on, there's no session yet.
    if (!data.session) setInfo(`Almost done. We’ve sent a confirmation link to ${email.trim()}. Open it to activate your account.`);
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free, and set up in about two minutes."
      footer={<>Already have an account?{' '}<button onClick={() => onNavigate('login')} className="font-semibold text-gold-500 hover:text-gold-400">Sign in</button></>}
    >
      {error && <Notice>{error}</Notice>}
      {info ? <Notice tone="success">{info}</Notice> : (
        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="label" htmlFor="username">Your name</label>
            <input className="input" id="username" autoComplete="given-name" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={60} />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input className="input" id="password" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <p className="hint">At least 6 characters.</p>
          </div>
          <div>
            <label className="label" htmlFor="currency">Currency</label>
            <select className="input" id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button className="btn-primary w-full !py-3.5" type="submit" disabled={loading}>{loading ? <Spinner /> : 'Create account'}</button>
        </form>
      )}
    </AuthLayout>
  );
};

export default RegisterPage;
