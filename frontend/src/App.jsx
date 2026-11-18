import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabase';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import DashboardPage from './components/DashboardPage';

const readTheme = () => {
  try { return localStorage.getItem('theme') || 'dark'; } catch { return 'dark'; }
};

const App = () => {
  const [session, setSession] = useState(null);
  const [authPage, setAuthPage] = useState('login');
  const [recovering, setRecovering] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#f8f9fa');
    try { localStorage.setItem('theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      // Only swap the session object on sign in/out so the dashboard doesn't remount on token refresh.
      setSession((prev) => (prev?.user?.id === newSession?.user?.id ? prev : newSession));
      if (!newSession) setAuthPage('login');
    });
    return () => subscription.unsubscribe();
  }, []);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  let content;
  if (loadingAuth) {
    content = (
      <div className="min-h-screen flex items-center justify-center bg-obsidian-900">
        <div className="w-12 h-12 bg-gold-gradient rounded-xl flex items-center justify-center font-serif text-2xl font-bold text-[#0a0a0a] animate-pulse">B</div>
      </div>
    );
  } else if (recovering) {
    content = <ResetPasswordPage onDone={() => setRecovering(false)} />;
  } else if (session?.user) {
    content = <DashboardPage key={session.user.id} user={session.user} theme={theme} toggleTheme={toggleTheme} />;
  } else if (authPage === 'register') {
    content = <RegisterPage onNavigate={setAuthPage} />;
  } else {
    content = <LoginPage onNavigate={setAuthPage} />;
  }

  return (
    <ToastProvider>
      <ConfirmProvider>{content}</ConfirmProvider>
    </ToastProvider>
  );
};

export default App;
