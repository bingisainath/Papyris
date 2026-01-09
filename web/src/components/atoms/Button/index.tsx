// src/components/atoms/Button.tsx
import React from 'react';

interface ButtonProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  onClick, 
  className = '', 
  disabled = false,
  loading = false,
  icon = null,
  iconPosition = 'left',
  fullWidth = false,
  type = 'button'
}) => {
  const variants: Record<string, string> = {
    primary: `
      bg-gradient-to-r from-primary-700 to-primary-600 
      hover:from-primary-600 hover:to-primary-500
      text-white shadow-card hover:shadow-elevated
      active:scale-[0.98]
    `,
    secondary: `
      bg-gradient-to-r from-secondary-300 to-secondary-400 
      hover:from-secondary-400 hover:to-secondary-500
      text-white shadow-soft
      active:scale-[0.98]
    `,
    ghost: `
      bg-transparent hover:bg-primary-50 
      text-primary-700 hover:text-primary-800
      active:scale-[0.98]
    `,
    outline: `
      bg-transparent border-2 border-primary-600 
      hover:bg-primary-50 hover:border-primary-700
      text-primary-700 hover:text-primary-800
      active:scale-[0.98]
    `,
    danger: `
      bg-gradient-to-r from-accent-600 to-accent-500 
      hover:from-accent-700 hover:to-accent-600
      text-white shadow-card hover:shadow-elevated
      active:scale-[0.98]
    `,
    success: `
      bg-gradient-to-r from-success-600 to-success-500 
      hover:from-success-700 hover:to-success-600
      text-white shadow-card hover:shadow-elevated
      active:scale-[0.98]
    `
  };
  
  const sizes: Record<string, string> = {
    xs: 'px-2.5 py-1.5 text-xs',
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl'
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center 
        font-semibold rounded-lg 
        transition-all duration-200
        ${variants[variant]} 
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {/* Loading spinner */}
      {loading && (
        <svg 
          className="animate-spin -ml-1 mr-2 h-4 w-4" 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}

      {/* Left icon */}
      {!loading && icon && iconPosition === 'left' && (
        <span className={children ? 'mr-2' : ''}>
          {icon}
        </span>
      )}

      {/* Button text */}
      {children}

      {/* Right icon */}
      {!loading && icon && iconPosition === 'right' && (
        <span className={children ? 'ml-2' : ''}>
          {icon}
        </span>
      )}
    </button>
  );
};

export default Button;