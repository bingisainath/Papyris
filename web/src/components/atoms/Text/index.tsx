// src/components/atoms/Text.tsx
import React from 'react';

interface TextProps {
  children: React.ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'small' | 'xs';
  weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold';
  className?: string;
  truncate?: boolean;
}

const Text: React.FC<TextProps> = ({ children, variant = 'body', weight = 'normal', className = '', truncate = false }) => {
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

  return (
    <span className={`${variants[variant]} ${weights[weight]} ${truncate ? 'truncate block' : ''} ${className}`}>
      {children}
    </span>
  );
};

export default Text;