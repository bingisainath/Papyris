// src/components/atoms/Divider.tsx
import React from 'react';

interface DividerProps {
  className?: string;
  spacing?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  orientation?: 'horizontal' | 'vertical';
  variant?: 'solid' | 'dashed' | 'gradient';
  text?: string;
}

const Divider: React.FC<DividerProps> = ({ 
  className = '', 
  spacing = 'md',
  orientation = 'horizontal',
  variant = 'solid',
  text
}) => {
  const spacings: Record<string, string> = {
    xs: orientation === 'horizontal' ? 'my-1' : 'mx-1',
    sm: orientation === 'horizontal' ? 'my-2' : 'mx-2',
    md: orientation === 'horizontal' ? 'my-4' : 'mx-4',
    lg: orientation === 'horizontal' ? 'my-6' : 'mx-6',
    xl: orientation === 'horizontal' ? 'my-8' : 'mx-8'
  };

  const variants: Record<string, string> = {
    solid: 'border-muted-200',
    dashed: 'border-muted-200 border-dashed',
    gradient: 'border-none h-px bg-gradient-to-r from-transparent via-primary-300 to-transparent'
  };

  // Divider with text
  if (text) {
    return (
      <div className={`flex items-center ${spacings[spacing]} ${className}`}>
        <div className={`flex-1 h-px ${variant === 'gradient' ? variants.gradient : `border-t ${variants[variant]}`}`} />
        <span className="px-3 text-sm text-muted-500 font-medium">{text}</span>
        <div className={`flex-1 h-px ${variant === 'gradient' ? variants.gradient : `border-t ${variants[variant]}`}`} />
      </div>
    );
  }

  // Regular divider
  if (orientation === 'vertical') {
    return (
      <div className={`${spacings[spacing]} ${className}`}>
        <div className={`w-px h-full ${variant === 'gradient' ? 'bg-gradient-to-b from-transparent via-primary-300 to-transparent' : `border-l ${variants[variant]}`}`} />
      </div>
    );
  }

  return (
    <hr className={`${variant === 'gradient' ? variants.gradient : `border-t ${variants[variant]}`} ${spacings[spacing]} ${className}`} />
  );
};

export default Divider;