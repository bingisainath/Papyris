// src/components/atoms/Textarea.tsx
import React, { forwardRef } from 'react';

interface TextareaProps {
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  className?: string;
  disabled?: boolean;
  error?: boolean | string;
  fullWidth?: boolean;
  name?: string;
  id?: string;
  required?: boolean;
  label?: string;
  helperText?: string;
  rows?: number;
  maxLength?: number;
  showCount?: boolean;
  resize?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ 
  placeholder,
  value = '',
  onChange,
  onFocus,
  onBlur,
  className = '',
  disabled = false,
  error = false,
  fullWidth = true,
  name,
  id,
  required = false,
  label,
  helperText,
  rows = 4,
  maxLength,
  showCount = false,
  resize = true
}, ref) => {
  const hasError = !!error;
  const errorMessage = typeof error === 'string' ? error : '';
  const characterCount = value.length;

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

      {/* Textarea Field */}
      <textarea
        ref={ref}
        name={name}
        id={id || name}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        rows={rows}
        maxLength={maxLength}
        className={`
          w-full px-4 py-2.5
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
          ${!resize ? 'resize-none' : 'resize-y'}
          ${className}
        `}
      />

      {/* Character Count / Helper Text / Error Message */}
      <div className="mt-1.5 flex justify-between items-center">
        {(helperText || errorMessage) && (
          <p className={`text-xs ${hasError ? 'text-accent-600' : 'text-muted-500'}`}>
            {errorMessage || helperText}
          </p>
        )}
        
        {showCount && maxLength && (
          <span className={`text-xs ml-auto ${characterCount > maxLength * 0.9 ? 'text-accent-600' : 'text-muted-400'}`}>
            {characterCount}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Textarea;