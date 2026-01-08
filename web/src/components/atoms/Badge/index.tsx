// src/components/atoms/Badge.tsx
import React from 'react';

interface BadgeProps {
  count: number;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'muted';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ count, variant = 'primary', size = 'md', className = '' }) => {
  if (!count || count === 0) return null;

  const variants: Record<string, string> = {
    primary: 'bg-[#25d366] text-white',
    success: 'bg-green-600 text-white',
    warning: 'bg-yellow-500 text-white',
    danger: 'bg-red-600 text-white',
    muted: 'bg-gray-300 text-gray-700'
  };

  const sizes: Record<string, string> = {
    sm: 'text-[10px] px-1.5 min-w-[16px] h-4',
    md: 'text-xs px-2 min-w-[20px] h-5',
    lg: 'text-sm px-2.5 min-w-[24px] h-6'
  };

  const displayCount = count > 99 ? '99+' : count;

  return (
    <span className={`inline-flex items-center justify-center rounded-full font-bold ${variants[variant]} ${sizes[size]} ${className}`}>
      {displayCount}
    </span>
  );
};

export default Badge;