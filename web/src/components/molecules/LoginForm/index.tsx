import React from "react";
import Input from "../../atoms/AuthInput";
import Button from "../../atoms/AuthButton";
import ErrorMessage from "../../atoms/ErrorMessage";
import "./LoginForm.css";
import { Link } from "react-router-dom";

interface LoginFormProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  error: string | null;
}

const LoginForm: React.FC<LoginFormProps> = ({
  email,
  setEmail,
  password,
  setPassword,
  onSubmit,
  error,
}) => {
  const handleButtonClick = () => {
    console.log("Button clicked");
    // Create a fake form event
    const fakeEvent = {
      preventDefault: () => { },
      stopPropagation: () => { },
    } as React.FormEvent<HTMLFormElement>;
    onSubmit(fakeEvent);
  };

  return (
    <form className="auth-form">
      <h1 className="auth-form-title">Sign In</h1>
      <ErrorMessage message={error} />
      <Input
        type="text"
        placeholder="Username or Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        id="loginIdentifier"
        name="loginIdentifier"
        autoComplete="username"
      />
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        id="loginPassword"
        name="loginPassword"
        autoComplete="current-password"
      />
      {/* <a href="#" className="forgot-password">
        Forget Your Password?
      </a> */}
      {/* <button
        type="button"
        className="forgot-password"
        onClick={() => console.log("Forgot password")}
      >
        Forgot your password?
      </button> */}

      {/* ✅ NEW: Forgot Password Link */}
      <Link
        to="/forgot-password"
        className="forgot-password"
        style={{
          display: 'block',
          textAlign: 'right',
          marginTop: '8px',
          marginBottom: '4px'
        }}
      >
        Forgot your password?
      </Link>
      <Button type="button" variant="submit" onClick={handleButtonClick}>
        Sign In
      </Button>
    </form>
  );
};

export default LoginForm;
