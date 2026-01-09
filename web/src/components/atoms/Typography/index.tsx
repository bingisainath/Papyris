// src/components/atoms/Typography.tsx
import React from 'react';

type TypographyVariant = 
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'body1' | 'body2' 
  | 'caption' | 'overline'
  | 'label' | 'helper';

type TypographyColor = 
  | 'primary' | 'secondary' | 'muted' 
  | 'success' | 'warning' | 'danger'
  | 'white' | 'inherit';

interface TypographyProps {
  variant?: TypographyVariant;
  color?: TypographyColor;
  className?: string;
  children: React.ReactNode;
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  align?: 'left' | 'center' | 'right';
  truncate?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

const Typography: React.FC<TypographyProps> = ({
  variant = 'body1',
  color = 'inherit',
  className = '',
  children,
  weight,
  align = 'left',
  truncate = false,
  as
}) => {
  const variants: Record<TypographyVariant, string> = {
    h1: 'text-4xl md:text-5xl font-bold leading-tight',
    h2: 'text-3xl md:text-4xl font-bold leading-tight',
    h3: 'text-2xl md:text-3xl font-semibold leading-snug',
    h4: 'text-xl md:text-2xl font-semibold leading-snug',
    h5: 'text-lg md:text-xl font-semibold leading-normal',
    h6: 'text-base md:text-lg font-semibold leading-normal',
    body1: 'text-base leading-relaxed',
    body2: 'text-sm leading-relaxed',
    caption: 'text-xs leading-normal',
    overline: 'text-xs uppercase tracking-wider font-medium',
    label: 'text-sm font-medium leading-normal',
    helper: 'text-xs text-muted-500 leading-normal'
  };

  const colors: Record<TypographyColor, string> = {
    primary: 'text-primary-700',
    secondary: 'text-secondary-500',
    muted: 'text-muted-600',
    success: 'text-success-600',
    warning: 'text-yellow-600',
    danger: 'text-accent-600',
    white: 'text-white',
    inherit: ''
  };

  const weights: Record<string, string> = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold'
  };

  const aligns: Record<string, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  };

  // Determine the HTML element to use
  const defaultElements: Record<TypographyVariant, keyof JSX.IntrinsicElements> = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    h6: 'h6',
    body1: 'p',
    body2: 'p',
    caption: 'span',
    overline: 'span',
    label: 'label',
    helper: 'span'
  };

  const Component = as || defaultElements[variant];

  return React.createElement(
    Component,
    {
      className: `
        ${variants[variant]}
        ${colors[color]}
        ${weight ? weights[weight] : ''}
        ${aligns[align]}
        ${truncate ? 'truncate' : ''}
        ${className}
      `.trim()
    },
    children
  );
};

export default Typography;