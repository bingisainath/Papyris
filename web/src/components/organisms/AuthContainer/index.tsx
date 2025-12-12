import React from "react";
import LoginForm from "../../molecules/LoginForm";
import RegisterForm from "../../molecules/RegisterForm";
import TogglePanel from "../../molecules/ TogglePanel";
import "./AuthContainer.css";
import { Images } from "../../../assets";

interface LoginData {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  error: string | null;
}

interface RegisterData {
  username: string;
  setUsername: (username: string) => void;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  error: string | null;
}

interface AuthContainerProps {
  isActive: boolean;
  loginData: LoginData;
  registerData: RegisterData;
  handleLoginClick: () => void;
  handleRegisterClick: () => void;
}

const AuthContainer: React.FC<AuthContainerProps> = ({
  isActive,
  loginData,
  registerData,
  handleLoginClick,
  handleRegisterClick,
}) => {
  return (
    <div className={`auth-container ${isActive ? "active" : ""}`}>
      <div className="form-container sign-up">
        <RegisterForm
          username={registerData.username}
          setUsername={registerData.setUsername}
          email={registerData.email}
          setEmail={registerData.setEmail}
          password={registerData.password}
          setPassword={registerData.setPassword}
          onSubmit={registerData.onSubmit}
          error={registerData.error}
        />
      </div>
      <div className="form-container sign-in">
        <LoginForm
          email={loginData.email}
          setEmail={loginData.setEmail}
          password={loginData.password}
          setPassword={loginData.setPassword}
          onSubmit={loginData.onSubmit}
          error={loginData.error}
        />
      </div>
      <div className="toggle-container">
        <div className="toggle">
          <TogglePanel
            logo={Images.logo}
            title="Welcome, Friend!"
            description="Already have an account? Sign in to continue."
            buttonText="Sign In"
            onButtonClick={handleLoginClick}
            position="left"
          />
          <TogglePanel
            logo={Images.logo}
            title="Welcome Back!"
            description="New here? Create an account to get started."
            buttonText="Sign Up"
            onButtonClick={handleRegisterClick}
            position="right"
          />
        </div>
      </div>
    </div>
  );
};

export default AuthContainer;