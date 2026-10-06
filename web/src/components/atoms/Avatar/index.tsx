// src/components/atoms/Avatar.tsx
import React, { useEffect, useState } from 'react';
import { resolveMediaUrl } from '../../../utils/media';

interface AvatarProps {
  src?: string | null;
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
  // Fall back to initials if the photo can't load (e.g. its link expired)
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  // Initials are drawn here (no third-party avatar service sees people's names)
  const initials = alt.trim().split(/[\s_.-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  const photo = !failed ? resolveMediaUrl(src) : null;

  const textSizes: Record<string, string> = {
    xs: 'text-[10px]', sm: 'text-xs', md: 'text-sm', lg: 'text-base', xl: 'text-xl', '2xl': 'text-2xl',
  };

  const sizes: Record<string, string> = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20'
  };

  return (
    <div data-avatar className={`relative inline-block flex-shrink-0 ${className}`}>
      {/* Purple ring for active/selected state */}
      {showRing && (
        <div className="absolute inset-0 rounded-full bg-primary-600 p-0.5">
          <div className="w-full h-full rounded-full bg-white" />
        </div>
      )}
      
      {/* Avatar image */}
      {photo ? (
        <img
          src={photo}
          onError={() => setFailed(true)}
          alt={alt}
          className={`${sizes[size]} rounded-full object-cover ${showRing ? 'relative z-10' : ''}`}
        />
      ) : (
        <span
          role="img"
          aria-label={alt}
          className={`${sizes[size]} ${textSizes[size]} rounded-full bg-primary-100 text-primary-800 font-semibold flex items-center justify-center select-none ${showRing ? 'relative z-10' : ''}`}
        >
          {initials}
        </span>
      )}
      
      {/* Online status indicator */}
      {online && (
        <span className="absolute bottom-0 right-0 block">
          <span className="block w-3 h-3 rounded-full bg-success-500 border-2 border-white" />
        </span>
      )}
    </div>
  );
};

export default Avatar;