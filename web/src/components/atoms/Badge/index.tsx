// src/components/atoms/Badge.tsx
import React from 'react';

interface BadgeProps {
  count?: number;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'muted' | 'accent';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode; // For text badges
  dot?: boolean; // Just show a dot indicator
}

const Badge: React.FC<BadgeProps> = ({ 
  count, 
  variant = 'primary', 
  size = 'md', 
  className = '',
  children,
  dot = false 
}) => {
  // Don't render if no count and no children
  if (!dot && !count && !children) return null;
  if (!dot && count === 0 && !children) return null;

  const variants: Record<string, string> = {
    primary: 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-glow',
    success: 'bg-gradient-to-r from-success-600 to-success-500 text-white',
    warning: 'bg-gradient-to-r from-yellow-500 to-yellow-400 text-white',
    danger: 'bg-gradient-to-r from-red-600 to-red-500 text-white',
    accent: 'bg-gradient-to-r from-accent-600 to-accent-500 text-white shadow-glow-accent',
    muted: 'bg-muted-200 text-muted-700'
  };

  const sizes: Record<string, string> = {
    xs: 'text-[9px] px-1 min-w-[14px] h-3.5',
    sm: 'text-[10px] px-1.5 min-w-[16px] h-4',
    md: 'text-xs px-2 min-w-[20px] h-5',
    lg: 'text-sm px-2.5 min-w-[24px] h-6'
  };

  // Dot indicator only
  if (dot) {
    const dotSizes: Record<string, string> = {
      xs: 'w-1.5 h-1.5',
      sm: 'w-2 h-2',
      md: 'w-2.5 h-2.5',
      lg: 'w-3 h-3'
    };
    return (
      <span className={`inline-block rounded-full ${variants[variant]} ${dotSizes[size]} ${className}`} />
    );
  }

  const displayCount = count && count > 99 ? '99+' : count;
  const content = children || displayCount;

  return (
    <span 
      className={`
        inline-flex items-center justify-center 
        rounded-full font-bold 
        transition-all duration-200
        ${variants[variant]} 
        ${sizes[size]} 
        ${className}
      `}
    >
      {content}
    </span>
  );
};

export default Badge;