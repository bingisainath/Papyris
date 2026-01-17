// src/pages/ResetPassword/index.tsx - NEW FILE

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyResetToken, resetPassword } = useAuth();

  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    checkToken();
  }, [token]);

  const checkToken = async () => {
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.');
      setVerifying(false);
      return;
    }

    try {
      const result = await verifyResetToken(token);
      setTokenValid(true);
      setEmail(result.email);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired reset token');
    } finally {
      setVerifying(false);
    }
  };

  const validatePassword = (): boolean => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validatePassword()) {
      return;
    }

    setLoading(true);

    try {
      await resetPassword(token!, password);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted-50 via-primary-50/20 to-secondary-50/30">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-600 font-medium">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  // Invalid token
  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted-50 via-primary-50/20 to-secondary-50/30 p-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-elevated p-8 w-full max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent-100 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-accent-600" />
          </div>
          <h1 className="text-2xl font-bold text-muted-900 mb-3">Invalid Reset Link</h1>
          <p className="text-muted-600 mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            <Link
              to="/forgot-password"
              className="py-3 bg-gradient-primary text-white rounded-xl font-semibold shadow-card hover:shadow-elevated transition-all hover:scale-[1.02]"
            >
              Request New Link
            </Link>
            <Link
              to="/login"
              className="py-3 border-2 border-primary-600 text-primary-700 rounded-xl font-semibold hover:bg-primary-50 transition-all"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted-50 via-primary-50/20 to-secondary-50/30 p-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-elevated p-8 w-full max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-success-100 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-success-600" />
          </div>
          <h1 className="text-2xl font-bold text-muted-900 mb-3">Password Reset Successful!</h1>
          <p className="text-muted-600 mb-2">Your password has been changed successfully.</p>
          <p className="text-sm text-muted-500 mb-6">Redirecting to login page...</p>
          <Link
            to="/login"
            className="inline-block py-3 px-6 bg-gradient-primary text-white rounded-xl font-semibold shadow-card hover:shadow-elevated transition-all hover:scale-[1.02]"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // Reset form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted-50 via-primary-50/20 to-secondary-50/30 p-4">
      <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-elevated p-8 w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-card">
            <span className="text-white text-2xl font-bold">P</span>
          </div>
          <h2 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Papyris
          </h2>
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-muted-900 mb-2">Reset Password</h1>
          <p className="text-muted-600">
            Enter your new password for{' '}
            <span className="font-semibold text-primary-700">{email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-muted-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-400 z-10" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
                className="w-full pl-12 pr-12 py-3 bg-muted-50 border-2 border-muted-200 rounded-xl 
                         focus:outline-none focus:border-primary-500 focus:bg-white 
                         transition-all disabled:opacity-60 disabled:cursor-not-allowed
                         text-muted-900 placeholder:text-muted-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-400 hover:text-muted-600 transition-colors z-10"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-muted-500 mt-1">Must be at least 6 characters</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-muted-700 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-400 z-10" />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full pl-12 pr-12 py-3 bg-muted-50 border-2 border-muted-200 rounded-xl 
                         focus:outline-none focus:border-primary-500 focus:bg-white 
                         transition-all disabled:opacity-60 disabled:cursor-not-allowed
                         text-muted-900 placeholder:text-muted-400"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-400 hover:text-muted-600 transition-colors z-10"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-accent-50 border-l-4 border-accent-500 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-accent-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-accent-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full py-3 bg-gradient-primary text-white rounded-xl font-semibold 
                     shadow-card hover:shadow-elevated transition-all 
                     disabled:opacity-60 disabled:cursor-not-allowed 
                     hover:scale-[1.02] active:scale-[0.98]
                     flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Resetting...
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;