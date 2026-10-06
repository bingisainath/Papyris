import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthContainer from "../../components/organisms/AuthContainer";
import "./LoginPage.css";
import { useAuth } from "../../app/AuthProvider";
import { validatePassword } from "../../utils/passwordPolicy";

import { toast } from "react-toastify";

const AuthenticationPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, resendCode } = useAuth();

  const [isActive, setIsActive] = useState<boolean>(false);
  // const navigate = useNavigate();
  // const dispatch = useDispatch();

  // Login state
  // const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginIdentifier, setLoginIdentifier] = useState<string>("");
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


    setLoginError(null);

    try {
      // const loginMail = loginEmail.toLocaleLowerCase();
      // await login(loginMail, loginPassword);
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

      // A 6-digit code is on its way: ask for it before the first sign-in
      navigate("/verify-email", { state: { email: lowerCaseEmail, justSent: true } });

    } catch (err: any) {
      toast.error(err.message || "Register failed");
      setRegisterError(err.message || "Register failed");
    }
  };

  const loginData = {
    email: loginIdentifier,
    setEmail: setLoginIdentifier,
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
