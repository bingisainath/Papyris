// src/components/atoms/Text/index.tsx
import React from 'react';

interface TextProps {
  children: React.ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'small' | 'xs';
  weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold';
  color?: 'default' | 'muted' | 'light' | 'primary' | 'success' | 'danger' | 'white';
  className?: string;
  truncate?: boolean;
}

const Text: React.FC<TextProps> = ({ 
  children, 
  variant = 'body', 
  weight = 'normal', 
  color = 'default',
  className = '', 
  truncate = false 
}) => {
  const variants: Record<string, string> = {
    h1: 'text-3xl',
    h2: 'text-2xl',
    h3: 'text-xl',
    h4: 'text-lg',
    body: 'text-base',
    small: 'text-sm',
    xs: 'text-xs'
  };

  const weights: Record<string, string> = {
    light: 'font-light',
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold'
  };

  const colors: Record<string, string> = {
    default: 'text-gray-900',
    muted: 'text-gray-500',
    light: 'text-gray-400',
    primary: 'text-blue-600',
    success: 'text-green-600',
    danger: 'text-red-600',
    white: 'text-white'
  };

  return (
    <span className={`${variants[variant]} ${weights[weight]} ${colors[color]} ${truncate ? 'truncate block' : ''} ${className}`}>
      {children}
    </span>
  );
};

export default Text;