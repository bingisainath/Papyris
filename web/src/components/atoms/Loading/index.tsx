// src/components/atoms/Loading.tsx
import React from 'react';

interface LoadingProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'spinner' | 'dots' | 'pulse';
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

const Loading: React.FC<LoadingProps> = ({ 
  size = 'md', 
  variant = 'spinner',
  text,
  fullScreen = false,
  className = '' 
}) => {
  const sizes: Record<string, string> = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  // Spinner variant
  const Spinner = () => (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`
          ${sizes[size]}
          border-4
          border-muted-200
          border-t-primary-600
          rounded-full
          animate-spin
        `}
      />
      {text && <p className="text-sm text-muted-600 animate-pulse">{text}</p>}
    </div>
  );

  // Dots variant
  const Dots = () => {
    const dotSizes: Record<string, string> = {
      xs: 'w-1.5 h-1.5',
      sm: 'w-2 h-2',
      md: 'w-3 h-3',
      lg: 'w-4 h-4',
      xl: 'w-5 h-5'
    };

    return (
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="flex gap-2">
          <div className={`${dotSizes[size]} bg-primary-600 rounded-full animate-bounce`} style={{ animationDelay: '0s' }} />
          <div className={`${dotSizes[size]} bg-primary-600 rounded-full animate-bounce`} style={{ animationDelay: '0.2s' }} />
          <div className={`${dotSizes[size]} bg-primary-600 rounded-full animate-bounce`} style={{ animationDelay: '0.4s' }} />
        </div>
        {text && <p className="text-sm text-muted-600">{text}</p>}
      </div>
    );
  };

  // Pulse variant
  const Pulse = () => (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`
          ${sizes[size]}
          bg-gradient-to-r from-primary-600 to-secondary-400
          rounded-full
          animate-pulse
        `}
      />
      {text && <p className="text-sm text-muted-600 animate-pulse">{text}</p>}
    </div>
  );

  const renderLoader = () => {
    switch (variant) {
      case 'spinner':
        return <Spinner />;
      case 'dots':
        return <Dots />;
      case 'pulse':
        return <Pulse />;
      default:
        return <Spinner />;
    }
  };

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        {renderLoader()}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      {renderLoader()}
    </div>
  );
};

export default Loading;