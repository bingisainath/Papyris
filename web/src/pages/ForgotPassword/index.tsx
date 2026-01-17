// src/pages/ForgotPassword/index.tsx

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';

const ForgotPassword: React.FC = () => {
    const { forgotPassword } = useAuth();

    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            console.log('1');
            await forgotPassword(identifier);
            console.log('2');
            setSubmitted(true);
        } catch (err: any) {
            console.log('catched called', err.message);
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Success state
    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted-50 via-primary-50/20 to-secondary-50/30 p-4">
                <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-elevated p-8 w-full max-w-md text-center animate-scale-in">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-success-100 flex items-center justify-center">
                        <CheckCircle className="w-10 h-10 text-success-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-muted-900 mb-3">Check Your Email</h1>
                    <p className="text-muted-600 mb-2">
                        If an account exists with{' '}
                        <span className="font-semibold text-primary-700">{identifier}</span>, you will receive a
                        password reset link shortly.
                    </p>
                    <p className="text-sm text-muted-500 mb-6">
                        The link will expire in 1 hour for security reasons.
                    </p>
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 text-primary-700 hover:text-primary-800 font-semibold transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Login
                    </Link>
                </div>
            </div>
        );
    }

    // Forgot Password Form
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted-50 via-primary-50/20 to-secondary-50/30 p-4">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-elevated p-8 w-full max-w-md animate-scale-in">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-card">
                        <span className="text-white text-2xl font-bold">P</span>
                    </div>
                    <h2 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                        Papyris
                    </h2>
                </div>

                {/* Title */}
                <div className="mb-6 text-center">
                    <h1 className="text-3xl font-bold text-muted-900 mb-2">Forgot Password?</h1>
                    <p className="text-muted-600">
                        No worries! Enter your username or email and we'll send you reset instructions.
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="identifier" className="block text-sm font-semibold text-muted-700 mb-2">
                            Username or Email
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-400" />
                            <input
                                id="identifier"
                                type="text"
                                placeholder="Enter your username or email"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                required
                                disabled={loading}
                                className="w-full pl-12 pr-4 py-3 bg-muted-50 border-2 border-muted-200 rounded-xl 
                         focus:outline-none focus:border-primary-500 focus:bg-white 
                         transition-all disabled:opacity-60 disabled:cursor-not-allowed
                         text-muted-900 placeholder:text-muted-400"
                            />
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
                        disabled={loading || !identifier.trim()}
                        className="w-full py-3 bg-gradient-primary text-white rounded-xl font-semibold 
                     shadow-card hover:shadow-elevated transition-all 
                     disabled:opacity-60 disabled:cursor-not-allowed 
                     hover:scale-[1.02] active:scale-[0.98]
                     flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <svg
                                    className="animate-spin h-5 w-5"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                Sending...
                            </>
                        ) : (
                            'Send Reset Link'
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 text-primary-700 hover:text-primary-800 font-semibold transition-colors text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;