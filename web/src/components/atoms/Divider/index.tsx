// src/components/atoms/Divider.tsx
import React from 'react';

interface DividerProps {
  className?: string;
  spacing?: 'sm' | 'md' | 'lg';
}

const Divider: React.FC<DividerProps> = ({ className = '', spacing = 'md' }) => {
  const spacings: Record<string, string> = {
    sm: 'my-2',
    md: 'my-4',
    lg: 'my-6'
  };

  return (
    <hr className={`border-gray-200 ${spacings[spacing]} ${className}`} />
  );
};

export default Divider;