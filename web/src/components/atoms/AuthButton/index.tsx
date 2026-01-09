import React from "react";
import "./Button.css";

interface ButtonProps {
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "submit";
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ 
  type = "button", 
  onClick, 
  children, 
  variant = "primary", 
  className = "" 
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`auth-button ${variant} ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;