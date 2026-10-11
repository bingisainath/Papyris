// src/pages/VerifyEmail/index.tsx
// Shown after sign-up (and when an unverified account tries to log in): enter the 6-digit emailed code.

import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../app/AuthProvider';
import AuthLayout, { AuthError, AuthSubmit } from '../../components/organisms/AuthLayout';

const LENGTH = 6;
const RESEND_SECONDS = 60;

const VerifyEmail: React.FC = () => {
  const { verifyEmail, resendCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as { email?: string; justSent?: boolean };
  const email = state.email || new URLSearchParams(location.search).get('email') || '';

  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(state.justSent ? RESEND_SECONDS : 0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) navigate('/login', { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  const submit = async (code: string) => {
    setBusy(true);
    setError('');
    try {
      await verifyEmail(email, code);
      toast.success('Email verified. Welcome to Papyris');
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'That code isn’t right');
      setDigits(Array(LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const setAt = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      setDigits((d) => d.map((x, i) => (i === index ? '' : x)));
      return;
    }
    // Typing or pasting several digits fills the following boxes
    const next = [...digits];
    clean.split('').slice(0, LENGTH - index).forEach((ch, k) => { next[index + k] = ch; });
    setDigits(next);
    const focusAt = Math.min(index + clean.length, LENGTH - 1);
    inputs.current[focusAt]?.focus();
    if (next.every((d) => d) && !busy) submit(next.join(''));
  };

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const resend = async () => {
    setError('');
    try {
      await resendCode(email);
      setWait(RESEND_SECONDS);
      toast.info('We sent a new code');
    } catch (err: any) {
      setError(err.message || 'Couldn’t send a new code');
    }
  };

  return (
    <AuthLayout
      icon={MailCheck}
      eyebrow="One last step"
      title="Verify your email"
      subtitle={<>We sent a 6-digit code to <b className="text-muted-900">{email}</b>. It expires in 10 minutes.</>}
    >
      <form onSubmit={(e) => { e.preventDefault(); if (digits.every((d) => d)) submit(digits.join('')); }}>
        <div className="grid grid-cols-6 gap-2" role="group" aria-label="Verification code">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              value={digit}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={LENGTH}
              disabled={busy}
              aria-label={`Digit ${i + 1}`}
              className="w-full h-14 text-center text-[21px] font-bold rounded-xl border border-muted-200 bg-white text-primary-700 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100 disabled:opacity-60"
            />
          ))}
        </div>

        <div className="mt-5"><AuthError message={error} /></div>

        <AuthSubmit disabled={busy || !digits.every((d) => d)}>
          {busy ? 'Checking…' : 'Verify email'}
        </AuthSubmit>
      </form>

      <p className="mt-6 text-center text-sm text-muted-500">
        Didn’t get it? Check spam, or{' '}
        {wait > 0 ? (
          <span>send a new code in <b className="text-primary-700">{wait}s</b></span>
        ) : (
          <button type="button" onClick={resend} className="font-bold text-primary-700 hover:underline">send a new code</button>
        )}
      </p>
      <Link to="/login" className="mt-5 flex items-center justify-center gap-1.5 text-sm font-bold text-primary-700 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to log in
      </Link>
    </AuthLayout>
  );
};

export default VerifyEmail;
