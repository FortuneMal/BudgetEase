import React from 'react';

const AuthLayout = ({ title, subtitle, children, footer }) => (
  <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-obsidian-900 relative overflow-hidden">
    <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] bg-gold-500/10 rounded-full blur-[120px] pointer-events-none" />
    <div className="w-full max-w-md relative z-10 py-10">
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="w-16 h-16 bg-gold-gradient rounded-2xl flex items-center justify-center mb-5 shadow-[0_0_40px_rgba(212,175,55,0.3)]">
          <span className="font-serif text-3xl font-bold text-[#0a0a0a]">B</span>
        </div>
        <h1 className="text-3xl font-serif text-white">{title}</h1>
        {subtitle && <p className="text-platinum-400 mt-2">{subtitle}</p>}
      </div>
      <div className="glass-card rounded-3xl p-6 sm:p-8 border-gold-gradient">{children}</div>
      {footer && <div className="mt-6 text-center text-platinum-400">{footer}</div>}
    </div>
  </div>
);

export const Spinner = () => (
  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export const Notice = ({ tone = 'error', children }) => (
  <div role={tone === 'error' ? 'alert' : 'status'} className={`text-sm p-3.5 rounded-xl mb-5 border ${tone === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'}`}>
    {children}
  </div>
);

export default AuthLayout;
