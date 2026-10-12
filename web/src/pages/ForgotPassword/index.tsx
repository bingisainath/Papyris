// src/pages/ForgotPassword/index.tsx

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck, UserRound } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';
import AuthLayout, { AuthError, AuthField, AuthSubmit } from '../../components/organisms/AuthLayout';

const BackToLogin = () => (
    <Link to="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-primary-700 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to log in
    </Link>
);

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
            await forgotPassword(identifier);
            setSubmitted(true);
        } catch (err: any) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <AuthLayout
                icon={MailCheck}
                eyebrow="Check your inbox"
                title="Reset link sent"
                subtitle={<>If an account exists for <b className="text-muted-900">{identifier}</b>, you'll get an email with a link to choose a new password. The link expires in 1 hour.</>}
            >
                <BackToLogin />
            </AuthLayout>
        );
    }

    return (
        <AuthLayout eyebrow="Account recovery" title="Forgot your password?" subtitle="Enter your username or email and we'll send you a link to reset it.">
            <form onSubmit={handleSubmit} noValidate>
                <AuthError message={error} />
                <AuthField
                    id="identifier" label="Username or email" icon={UserRound}
                    placeholder="Username or email" autoComplete="username" autoCapitalize="none"
                    value={identifier} onChange={(e) => setIdentifier(e.target.value)} disabled={loading}
                />
                <AuthSubmit className="mt-2" disabled={loading || !identifier.trim()}>
                    {loading ? 'Sending…' : 'Send reset link'}
                </AuthSubmit>
            </form>
            <BackToLogin />
        </AuthLayout>
    );
};

export default ForgotPassword;
