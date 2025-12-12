import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
// import axiosHelper from "../../helper/axiosHelper";
// import { setToken } from "../../redux/userSlice";
import AuthContainer from "../../components/organisms/AuthContainer";
import "./LoginPage.css";

interface ApiResponse {
  success: boolean;
  token?: string;
  message?: string;
}

const LoginPage: React.FC = () => {
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

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    // try {
    //   const response: ApiResponse = await axiosHelper(
    //     "post",
    //     `${process.env.REACT_APP_BACKEND_URL}/api/login`,
    //     { email: loginEmail, password: loginPassword }
    //   );
    //   console.log("login res", response);
    //   if (response.success) {
    //     dispatch(setToken(response?.token));
    //     localStorage.setItem("token", response?.token || "");
    //     navigate("/home");
    //   } else {
    //     setLoginError("Failed to login. Please check your credentials.");
    //   }
    // } catch (error) {
    //   setLoginError("Failed to login. Please check your credentials.");
    // }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    // try {
    //   const response: ApiResponse = await axiosHelper(
    //     "post",
    //     `${process.env.REACT_APP_BACKEND_URL}/api/register`,
    //     {
    //       name: registerUsername,
    //       email: registerEmail,
    //       password: registerPassword,
    //     }
    //   );
    //   console.log("reg res", response);
    //   if (response.success) {
    //     dispatch(setToken(response?.token));
    //     localStorage.setItem("token", response?.token || "");
    //     navigate("/home");
    //   } else {
    //     setRegisterError("Failed to register. Please try again.");
    //   }
    // } catch (error) {
    //   setRegisterError("Failed to register. Please try again.");
    // }
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

export default LoginPage;