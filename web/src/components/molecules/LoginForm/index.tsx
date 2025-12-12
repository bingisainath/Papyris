import React from "react";
import Input from "../../atoms/Input";
import Button from "../../atoms/Button";
import ErrorMessage from "../../atoms/ErrorMessage";
import "./LoginForm.css";

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
  error 
}) => {
  return (
    <form onSubmit={onSubmit} className="auth-form">
      <h1 className="auth-form-title">Sign In</h1>
      <ErrorMessage message={error} />
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        id="loginEmail"
        name="loginEmail"
        autoComplete="email"
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
      <a href="#" className="forgot-password">Forget Your Password?</a>
      <Button type="submit" variant="submit">
        Sign In
      </Button>
    </form>
  );
};

export default LoginForm;