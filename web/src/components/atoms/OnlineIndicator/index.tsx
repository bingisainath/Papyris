// src/components/atoms/OnlineIndicator.tsx
import React from 'react';

interface OnlineIndicatorProps {
  isOnline: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const OnlineIndicator: React.FC<OnlineIndicatorProps> = ({ isOnline, size = 'md' }) => {
  const sizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  if (!isOnline) return null;

  return (
    <div className={`${sizes[size]} bg-green-500 rounded-full border-2 border-white absolute bottom-0 right-0`} />
  );
};

export default OnlineIndicator;