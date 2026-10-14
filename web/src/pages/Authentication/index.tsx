// src/pages/Authentication/index.tsx
// Log in (/login) and create an account (/signup).

import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, AtSign, Check, KeyRound, Mail, UserRound } from "lucide-react";
import { toast } from "react-toastify";
import AuthLayout, { AuthError, AuthField, AuthSubmit } from "../../components/organisms/AuthLayout";
import { useAuth } from "../../app/AuthProvider";
import { validatePassword } from "../../utils/passwordPolicy";

const PASSWORD_RULES: [string, (p: string) => boolean][] = [
  ["8+ characters", (p) => p.length >= 8],
  ["Upper and lower case", (p) => /[a-z]/.test(p) && /[A-Z]/.test(p)],
  ["A number", (p) => /\d/.test(p)],
  ["A symbol", (p) => /[^A-Za-z0-9]/.test(p)],
];

const PasswordRules: React.FC<{ password: string }> = ({ password }) => (
  <ul className="grid grid-cols-2 gap-x-3 gap-y-1" aria-label="Password rules">
    {PASSWORD_RULES.map(([text, ok]) => {
      const met = ok(password);
      return (
        <li key={text} className={`flex items-center gap-1.5 ${met ? "text-success-700" : "text-muted-500"}`}>
          <Check size={13} className={met ? "" : "opacity-30"} /> {text}
        </li>
      );
    })}
  </ul>
);

const AuthenticationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, resendCode } = useAuth();
  const signingUp = location.pathname === "/signup";

  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerError, setRegisterError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);
    setBusy(true);
    try {
      await login(loginIdentifier.trim(), loginPassword);
      toast.success("Logged in successfully");
      navigate("/", { replace: true });
    } catch (err: any) {
      if (err.code === "email_not_verified") {
        // Signed up but never entered the code: send a fresh one and ask for it
        resendCode(err.email).catch(() => undefined);
        navigate("/verify-email", { state: { email: err.email, justSent: true } });
        return;
      }
      setLoginError(err.message || "Invalid credentials");
    } finally {
      setBusy(false);
    }
  };

  const [emailTypo, setEmailTypo] = useState<string | null>(null); // "Did you mean …?" suggestion

  const handleRegister = async (e?: React.FormEvent<HTMLFormElement>, emailOverride?: string, typoChecked = false) => {
    e?.preventDefault();
    setRegisterError(null);
    setEmailTypo(null);

    const pwdErr = validatePassword(registerPassword);
    if (pwdErr) {
      setRegisterError(pwdErr);
      return;
    }

    setBusy(true);
    try {
      const email = (emailOverride ?? registerEmail).trim().toLocaleLowerCase();
      await register(registerUsername.toLocaleLowerCase(), email, registerPassword, typoChecked);
      // A 6-digit code is on its way: ask for it before the first sign-in
      navigate("/verify-email", { state: { email, justSent: true } });
    } catch (err: any) {
      if (err.suggestion) setEmailTypo(err.suggestion);
      else setRegisterError(err.message || "Couldn't create your account");
    } finally {
      setBusy(false);
    }
  };

  if (signingUp) {
    return (
      <AuthLayout eyebrow="Your private space" title="Create your account" subtitle="Free, private, and built for real life.">
        <form onSubmit={handleRegister} noValidate>
          <AuthError message={registerError} />
          <AuthField
            id="registerUsername" name="registerUsername" label="Username" icon={AtSign}
            placeholder="e.g. maya.rao" autoComplete="username" autoCapitalize="none"
            value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)}
          />
          <AuthField
            id="registerEmail" name="registerEmail" label="Email" icon={Mail} type="email"
            placeholder="you@example.com" autoComplete="email"
            value={registerEmail} onChange={(e) => { setRegisterEmail(e.target.value); setEmailTypo(null); }}
          />
          {emailTypo && (
            <div role="alert" className="-mt-2 mb-4 p-3 rounded-xl bg-primary-50 border border-primary-100 text-sm text-muted-800">
              Did you mean <b>{emailTypo}</b>?
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy} onClick={() => { setRegisterEmail(emailTypo); handleRegister(undefined, emailTypo); }}
                  className="h-8 px-3 rounded-lg text-xs font-bold text-white bg-primary-700 hover:bg-primary-800">Use {emailTypo}</button>
                <button type="button" disabled={busy} onClick={() => handleRegister(undefined, undefined, true)}
                  className="h-8 px-3 rounded-lg text-xs font-semibold text-primary-700 hover:bg-primary-100">Keep {registerEmail.trim()}</button>
              </div>
            </div>
          )}
          <AuthField
            id="registerPassword" name="registerPassword" label="Password" icon={KeyRound} type="password"
            placeholder="Create a password" autoComplete="new-password"
            value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)}
            hint={<PasswordRules password={registerPassword} />}
          />
          <AuthSubmit className="mt-3" disabled={busy || !registerUsername.trim() || !registerEmail.trim() || !registerPassword}>
            {busy ? "Creating account…" : <>Create account <ArrowRight size={17} /></>}
          </AuthSubmit>
          <p className="mt-3 text-center text-xs text-muted-500">
            By creating an account you agree to the{" "}
            <Link to="/terms" className="font-semibold text-primary-700 hover:underline">Terms of Service</Link> and{" "}
            <Link to="/privacy" className="font-semibold text-primary-700 hover:underline">Privacy Policy</Link>, and confirm you're 18 or older.
          </p>
        </form>
        <p className="mt-6 text-center text-muted-500">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-primary-700 hover:underline">Log in</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Welcome back" title="Log in to ShareEven" subtitle="Your people and shared moments are waiting.">
      <form onSubmit={handleLogin} noValidate>
        <AuthError message={loginError} />
        <AuthField
          id="loginIdentifier" name="loginIdentifier" label="Username or email" icon={UserRound}
          placeholder="Username or email" autoComplete="username" autoCapitalize="none"
          value={loginIdentifier} onChange={(e) => setLoginIdentifier(e.target.value)}
        />
        <AuthField
          id="loginPassword" name="loginPassword" label="Password" icon={KeyRound} type="password"
          placeholder="Your password" autoComplete="current-password"
          value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
          className="mb-2"
        />
        <div className="flex justify-end mb-5">
          <Link to="/forgot-password" className="text-xs font-bold text-primary-700 hover:underline">Forgot password?</Link>
        </div>
        <AuthSubmit disabled={busy || !loginIdentifier.trim() || !loginPassword}>
          {busy ? "Logging in…" : <>Log in <ArrowRight size={17} /></>}
        </AuthSubmit>
      </form>
      <p className="mt-6 text-center text-muted-500">
        New to ShareEven?{" "}
        <Link to="/signup" className="font-bold text-primary-700 hover:underline">Create an account</Link>
      </p>
    </AuthLayout>
  );
};

export default AuthenticationPage;
