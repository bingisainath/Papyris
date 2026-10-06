// src/pages/VerifyEmail/index.tsx
// Shown after sign-up (and when an unverified account tries to log in): enter the 6-digit emailed code.

import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, MailCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../app/AuthProvider';

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
    <div className="min-h-screen flex items-center justify-center bg-muted-50 p-4">
      <div className="bg-white border border-muted-200 rounded-2xl shadow-card p-8 w-full max-w-md">
        <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-primary-50 flex items-center justify-center">
          <MailCheck className="w-7 h-7 text-primary-700" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-semibold text-muted-900 text-center">Check your email</h1>
        <p className="mt-2 text-center text-muted-600">
          We sent a 6-digit code to <span className="font-medium text-muted-900">{email}</span>. It expires in 10 minutes.
        </p>

        <form
          className="mt-7"
          onSubmit={(e) => { e.preventDefault(); if (digits.every((d) => d)) submit(digits.join('')); }}
        >
          <div className="flex justify-center gap-2 sm:gap-3" role="group" aria-label="Verification code">
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
                className="w-11 h-12 sm:w-12 sm:h-14 text-center text-xl font-semibold rounded-lg border border-muted-300 bg-white text-muted-900 focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
              />
            ))}
          </div>

          {error && (
            <div className="mt-5 p-3 bg-accent-50 border border-accent-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-accent-600 flex-shrink-0" />
              <p className="text-sm text-accent-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !digits.every((d) => d)}
            className="mt-6 w-full py-3 rounded-lg bg-primary-700 hover:bg-primary-800 text-white font-medium transition-colors disabled:opacity-50"
          >
            {busy ? 'Checking…' : 'Verify'}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-muted-600">
          Didn’t get it? Check spam, or{' '}
          {wait > 0 ? (
            <span className="text-muted-500">send a new code in {wait}s</span>
          ) : (
            <button type="button" onClick={resend} className="font-medium text-primary-700 hover:underline">
              send a new code
            </button>
          )}
        </div>
        <div className="mt-6 text-center">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-600 hover:text-primary-700">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
