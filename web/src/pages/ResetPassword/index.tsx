// src/pages/ResetPassword/index.tsx
// Opened from the reset email: check the link, then choose a new password.

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound, LinkIcon } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';
import AuthLayout, { AuthError, AuthField, AuthSubmit } from '../../components/organisms/AuthLayout';
import { validatePassword } from '../../utils/passwordPolicy';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyResetToken, resetPassword } = useAuth();

  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!token) {
      setError('This reset link is incomplete. Please request a new one.');
      setVerifying(false);
      return;
    }
    verifyResetToken(token)
      .then((result) => {
        setTokenValid(true);
        setEmail(result.email);
      })
      .catch((err: any) => setError(err.message || 'This reset link is invalid or has expired.'))
      .finally(() => setVerifying(false));
  }, [token, verifyResetToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // Same rules as when signing up
    const problem = validatePassword(password) || (password !== confirmPassword ? 'Passwords do not match.' : null);
    if (problem) {
      setError(problem);
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token!, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <AuthLayout title="Checking your link…">
        <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
      </AuthLayout>
    );
  }

  if (!tokenValid) {
    return (
      <AuthLayout icon={LinkIcon} eyebrow="Account recovery" title="This link doesn't work" subtitle={error}>
        <Link to="/forgot-password" className="w-full h-12 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-bold text-sm grid place-items-center">
          Request a new link
        </Link>
        <Link to="/login" className="mt-3 w-full h-12 rounded-xl border border-primary-200 bg-primary-50 text-primary-700 font-bold text-sm grid place-items-center hover:bg-primary-100">
          Back to log in
        </Link>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout icon={CheckCircle2} eyebrow="All done" title="Password changed" subtitle="You can log in with your new password. Taking you there now…">
        <Link to="/login" className="w-full h-12 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-bold text-sm grid place-items-center">
          Go to log in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Account recovery" title="Choose a new password" subtitle={<>For <b className="text-muted-900">{email}</b></>}>
      <form onSubmit={handleSubmit} noValidate>
        <AuthError message={error} />
        <AuthField
          id="password" label="New password" icon={KeyRound} type="password"
          placeholder="New password" autoComplete="new-password" disabled={loading}
          value={password} onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters, with upper and lower case letters, a number and a symbol."
        />
        <AuthField
          id="confirmPassword" label="Confirm new password" icon={KeyRound} type="password"
          placeholder="Type it again" autoComplete="new-password" disabled={loading}
          value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <AuthSubmit className="mt-2" disabled={loading || !password || !confirmPassword}>
          {loading ? 'Saving…' : 'Reset password'}
        </AuthSubmit>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;
