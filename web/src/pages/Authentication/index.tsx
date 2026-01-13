import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
// import axiosHelper from "../../helper/axiosHelper";
// import { setToken } from "../../redux/userSlice";
import AuthContainer from "../../components/organisms/AuthContainer";
import "./LoginPage.css";
import { useAuth } from "../../app/AuthProvider";
import { validatePassword } from "../../utils/passwordPolicy";

import { connectWebSocket } from '../../redux/actions/websocketActions';

import { toast } from "react-toastify";

const AuthenticationPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const dispatch = useDispatch();

  const [isActive, setIsActive] = useState<boolean>(false);
  // const navigate = useNavigate();
  // const dispatch = useDispatch();

  // Login state
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register state
  const [registerUsername, setRegisterUsername] = useState<string>("");
  const [registerEmail, setRegisterEmail] = useState<string>("");
  const [registerPassword, setRegisterPassword] = useState<string>("");
  const [registerError, setRegisterError] = useState<string | null>(null);

  const handleRegisterClick = (): void => setIsActive(true);
  const handleLoginClick = (): void => setIsActive(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    // These should be the VERY FIRST lines
    e.preventDefault();
    e.stopPropagation();

    console.log('login called 1');

    setLoginError(null);

    try {
      console.log("Attempting login...");
      const loginMail = loginEmail.toLocaleLowerCase();
      console.log('login called 2', loginMail);
      await login(loginMail, loginPassword);
      toast.success("Logged in successfully");
      console.log("Login successful, navigating...");
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Login error caught:", err);
      toast.error(err.message || "Login failed");
      setLoginError(err.message || "Invalid credentials");
      // Make sure we're NOT navigating here
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setRegisterError(null);

    const pwdErr = validatePassword(registerPassword);
    if (pwdErr) {
      setRegisterError(pwdErr);
      toast.error(pwdErr);
      return;
    }

    try {
      const loewCaseregisterUserName = registerUsername.toLocaleLowerCase();
      const lowerCaseEmail = registerEmail.toLocaleLowerCase();
      await register(
        loewCaseregisterUserName,
        lowerCaseEmail,
        registerPassword
      );

      toast.success("Registered successfully");
      console.log("[UI] Registered");
      setIsActive(false);

    } catch (err: any) {
      toast.error(err.message || "Register failed");
      setRegisterError(err.message || "Register failed");
      console.log("[UI] Register error:", err.message);
    }
  };

  const loginData = {
    email: loginEmail,
    setEmail: setLoginEmail,
    password: loginPassword,
    setPassword: setLoginPassword,
    onSubmit: handleLogin,
    error: loginError,
  };

  const registerData = {
    username: registerUsername,
    setUsername: setRegisterUsername,
    email: registerEmail,
    setEmail: setRegisterEmail,
    password: registerPassword,
    setPassword: setRegisterPassword,
    onSubmit: handleRegister,
    error: registerError,
  };

  return (
    <div className="login-page">
      <AuthContainer
        isActive={isActive}
        loginData={loginData}
        registerData={registerData}
        handleLoginClick={handleLoginClick}
        handleRegisterClick={handleRegisterClick}
      />
    </div>
  );
};

export default AuthenticationPage;
