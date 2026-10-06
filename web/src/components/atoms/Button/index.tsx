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
  title?: string; // tooltip; also used as the accessible name for icon-only buttons
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
  type = 'button',
  title
}) => {
  const variants: Record<string, string> = {
    primary: `
      bg-primary-700
      hover:bg-primary-800
      text-white
    `,
    secondary: `
      bg-white border border-muted-300
      hover:bg-muted-50 hover:border-primary-300
      text-muted-800
    `,
    ghost: `
      bg-transparent hover:bg-primary-50 
      text-primary-700 hover:text-primary-800
    `,
    outline: `
      bg-transparent border border-primary-600 
      hover:bg-primary-50 hover:border-primary-700
      text-primary-700 hover:text-primary-800
    `,
    danger: `
      bg-accent-600 
      hover:bg-accent-700
      text-white shadow-card hover:shadow-elevated
    `,
    success: `
      bg-success-600 
      hover:bg-success-700
      text-white shadow-card hover:shadow-elevated
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
      title={title}
      aria-label={title && !children ? title : undefined}
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