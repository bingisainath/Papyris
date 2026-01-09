// src/components/atoms/Input.tsx
import React, { forwardRef } from 'react';

interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'search';
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
  error?: boolean | string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  name?: string;
  id?: string;
  autoComplete?: string;
  required?: boolean;
  label?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ 
  type = 'text',
  placeholder,
  value,
  onChange,
  onFocus,
  onBlur,
  className = '',
  disabled = false,
  error = false,
  leftIcon,
  rightIcon,
  fullWidth = true,
  name,
  id,
  autoComplete,
  required = false,
  label,
  helperText
}, ref) => {
  const hasError = !!error;
  const errorMessage = typeof error === 'string' ? error : '';

  return (
    <div className={`${fullWidth ? 'w-full' : ''}`}>
      {/* Label */}
      {label && (
        <label 
          htmlFor={id || name}
          className="block text-sm font-medium text-muted-700 mb-1.5"
        >
          {label}
          {required && <span className="text-accent-500 ml-1">*</span>}
        </label>
      )}

      {/* Input Container */}
      <div className="relative">
        {/* Left Icon */}
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-500">
            {leftIcon}
          </div>
        )}

        {/* Input Field */}
        <input
          ref={ref}
          type={type}
          name={name}
          id={id || name}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          required={required}
          className={`
            w-full px-4 py-2.5
            ${leftIcon ? 'pl-10' : ''}
            ${rightIcon ? 'pr-10' : ''}
            rounded-lg
            border-2
            ${hasError 
              ? 'border-accent-500 focus:border-accent-600 focus:ring-accent-500/20' 
              : 'border-muted-200 focus:border-primary-600 focus:ring-primary-600/20'
            }
            bg-white
            text-muted-900
            placeholder:text-muted-400
            transition-all duration-200
            focus:outline-none
            focus:ring-4
            disabled:bg-muted-50
            disabled:text-muted-500
            disabled:cursor-not-allowed
            ${className}
          `}
        />

        {/* Right Icon */}
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-500">
            {rightIcon}
          </div>
        )}
      </div>

      {/* Helper Text or Error Message */}
      {(helperText || errorMessage) && (
        <p className={`mt-1.5 text-xs ${hasError ? 'text-accent-600' : 'text-muted-500'}`}>
          {errorMessage || helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;