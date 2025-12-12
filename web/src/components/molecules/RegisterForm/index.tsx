import React from "react";
import Input from "../../atoms/Input";
import Button from "../../atoms/Button";
import ErrorMessage from "../../atoms/ErrorMessage";
import "./RegisterForm.css";

interface RegisterFormProps {
  username: string;
  setUsername: (username: string) => void;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  error: string | null;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ 
  username, 
  setUsername, 
  email, 
  setEmail, 
  password, 
  setPassword, 
  onSubmit, 
  error 
}) => {
  return (
    <form onSubmit={onSubmit} className="auth-form">
      <h1 className="auth-form-title">Create Account</h1>
      <ErrorMessage message={error} />
      <Input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        id="registerUsername"
        name="registerUsername"
        autoComplete="name"
      />
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        id="registerEmail"
        name="registerEmail"
        autoComplete="email"
      />
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        id="registerPassword"
        name="registerPassword"
        autoComplete="new-password"
      />
      <Button type="submit" variant="submit">
        Sign Up
      </Button>
    </form>
  );
};

export default RegisterForm;