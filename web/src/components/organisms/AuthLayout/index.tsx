// src/components/organisms/AuthLayout/index.tsx
// The frame for every signed-out page: a purple brand panel on the left (desktop only) and the form
// on the right. AuthField is the labelled input with an icon those forms use.

import React, { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const BrandMark: React.FC<{ inverted?: boolean }> = ({ inverted }) => (
  <div className="flex items-center gap-2.5">
    <span className={`w-[42px] h-[42px] rounded-[13px] grid place-items-center font-display font-bold text-xl ${
      inverted ? 'bg-white text-primary-700' : 'bg-primary-700 text-white'
    }`}>P</span>
    <span className={`font-display font-bold text-xl ${inverted ? 'text-white' : 'text-muted-900'}`}>Papyris</span>
  </div>
);

const BrandPanel: React.FC = () => (
  <section className="hidden lg:flex relative overflow-hidden flex-col px-[clamp(30px,5vw,80px)] py-10 text-white bg-gradient-to-br from-[#433263] to-[#624b8a]">
    <BrandMark inverted />

    {/* A glimpse of the app: a split, the lock, a settled balance */}
    <div className="relative h-[340px] mt-9" aria-hidden>
      <div className="absolute left-[8%] top-[6%] -rotate-3 bg-white text-muted-900 px-[18px] py-3.5 rounded-[17px] shadow-[0_15px_30px_rgba(37,25,54,0.33)]">
        <p className="text-sm">Dinner was €84</p>
        <p className="mt-1 text-sm font-bold text-primary-700">Split 4 ways · €21 each</p>
      </div>
      <div className="absolute left-[42%] top-[38%] w-[90px] h-[90px] rounded-[28px] bg-white/10 border border-white/20 grid place-items-center">
        <ShieldCheck size={38} strokeWidth={1.6} />
      </div>
      <div className="absolute right-[6%] top-[62%] rotate-2 bg-white text-muted-900 px-[18px] py-3.5 rounded-[17px] shadow-[0_15px_30px_rgba(37,25,54,0.33)]">
        <p className="text-sm">You’re all settled</p>
        <p className="mt-1 text-sm font-bold text-primary-700 flex items-center gap-1"><CheckCircle2 size={15} /> Fair and simple</p>
      </div>
    </div>

    <div className="mt-auto mb-6 max-w-[540px]">
      <h1 className="font-display text-[clamp(38px,4.2vw,62px)] leading-[1.08] tracking-[-0.05em] font-semibold">
        Chat privately.<br />Split fairly.
      </h1>
      <p className="text-[17px] leading-relaxed text-primary-100 my-5">
        One place for your conversations, shared moments and everyday expenses.
      </p>
      <p className="flex items-center gap-2 text-xs text-primary-100">
        <Lock size={15} /> Messages and media are end-to-end encrypted
      </p>
    </div>
  </section>
);

interface AuthLayoutProps {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ eyebrow, title, subtitle, icon: TitleIcon, children }) => (
  <main className="min-h-screen grid lg:grid-cols-[1.05fr_0.95fr] bg-white">
    <BrandPanel />
    <section className="flex flex-col min-h-screen">
      <div className="w-full max-w-[460px] mx-auto my-auto px-5 sm:px-0 py-10">
        <div className="lg:hidden mb-12"><BrandMark /></div>
        {TitleIcon && (
          <span className="mb-5 w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 grid place-items-center">
            <TitleIcon size={24} strokeWidth={1.75} />
          </span>
        )}
        {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-500">{eyebrow}</p>}
        <h2 className="mt-1.5 font-display text-[29px] font-semibold tracking-[-0.03em] text-muted-900">{title}</h2>
        {subtitle && <p className="mt-2 mb-7 text-muted-500">{subtitle}</p>}
        {!subtitle && <div className="mb-7" />}
        {children}
      </div>
    </section>
  </main>
);

interface AuthFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: LucideIcon;
  hint?: React.ReactNode;
}

/** A labelled input with a leading icon. Password fields get a show/hide button. */
export const AuthField: React.FC<AuthFieldProps> = ({ id, label, icon: FieldIcon, hint, type = 'text', className = '', ...input }) => {
  const [shown, setShown] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className={`mb-4 ${className}`}>
      <label htmlFor={id} className="block mb-1.5 text-xs font-bold text-muted-500">{label}</label>
      <div className="relative">
        <FieldIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-400 pointer-events-none" />
        <input
          id={id}
          type={isPassword && shown ? 'text' : type}
          className={`w-full h-12 pl-11 ${isPassword ? 'pr-12' : 'pr-4'} rounded-xl border border-muted-200 bg-white text-muted-900 placeholder:text-muted-400 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100 disabled:opacity-60`}
          {...input}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg grid place-items-center text-muted-500 hover:text-primary-700 hover:bg-primary-50"
          >
            {shown ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {hint && <div className="mt-1.5 text-xs text-muted-500">{hint}</div>}
    </div>
  );
};

/** Full-width primary button for the auth forms. */
export const AuthSubmit: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className = '', ...button }) => (
  <button
    type="submit"
    className={`w-full h-12 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-bold text-sm shadow-[0_5px_14px_rgba(84,63,125,0.18)] inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    {...button}
  >
    {children}
  </button>
);

export const AuthError: React.FC<{ message?: string | null }> = ({ message }) =>
  message ? (
    <div role="alert" className="mb-4 px-3.5 py-3 rounded-xl bg-accent-50 border border-accent-200 text-sm text-accent-700">{message}</div>
  ) : null;

export default AuthLayout;
