// src/components/atoms/Avatar.tsx
import React from 'react';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  online?: boolean;
  className?: string;
  showRing?: boolean; // Purple ring for active/selected state
}

const Avatar: React.FC<AvatarProps> = ({ 
  src, 
  alt = 'Avatar', 
  size = 'md', 
  online = false, 
  className = '',
  showRing = false 
}) => {
  const sizes: Record<string, string> = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20'
  };

  return (
    <div className={`relative inline-block flex-shrink-0 ${className}`}>
      {/* Purple ring for active/selected state */}
      {showRing && (
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary-600 to-secondary-400 p-0.5 animate-pulse-soft">
          <div className="w-full h-full rounded-full bg-white" />
        </div>
      )}
      
      {/* Avatar image */}
      <img
        src={src || `https://ui-avatars.com/api/?name=${encodeURIComponent(alt)}&background=7e22ce&color=fff&bold=true`}
        alt={alt}
        className={`${sizes[size]} rounded-full object-cover ${showRing ? 'relative z-10' : ''} transition-all duration-300 hover:scale-105`}
      />
      
      {/* Online status indicator */}
      {online && (
        <span className="absolute bottom-0 right-0 block">
          <span className="block w-3 h-3 rounded-full bg-success-500 border-2 border-white shadow-sm" />
          {/* Pulse animation for online status */}
          <span className="absolute top-0 left-0 w-3 h-3 rounded-full bg-success-400 animate-ping opacity-75" />
        </span>
      )}
    </div>
  );
};

export default Avatar;