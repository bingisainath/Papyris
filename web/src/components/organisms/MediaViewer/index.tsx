// src/components/organisms/MediaViewer/index.tsx
// Full-screen image viewer for a conversation's photos.

import React, { useEffect, useRef } from 'react';
import Icon from '../../atoms/Icon';
import { formatMessageTime } from '../../../utils/dateFormat';

export interface ViewerImage {
  id: string;
  url: string;
  filename?: string;
  senderName?: string;
  timestamp: string;
}

interface MediaViewerProps {
  images: ViewerImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

const MediaViewer: React.FC<MediaViewerProps> = ({ images, index, onIndexChange, onClose }) => {
  const image = images[index];
  const swipeStartX = useRef<number | null>(null);
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && hasPrev) onIndexChange(index - 1);
      else if (e.key === 'ArrowRight' && hasNext) onIndexChange(index + 1);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [index, hasPrev, hasNext, onClose, onIndexChange]);

  if (!image) return null;

  const onPointerUp = (e: React.PointerEvent) => {
    if (swipeStartX.current === null) return;
    const dx = e.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (dx > 50 && hasPrev) onIndexChange(index - 1);
    else if (dx < -50 && hasNext) onIndexChange(index + 1);
  };

  return (
    <div
      role="dialog"
      aria-label="Image viewer"
      className="fixed inset-0 z-[60] flex flex-col bg-black/90 animate-fade-in select-none"
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{image.senderName || 'Photo'}</p>
          <p className="text-xs text-white/60">
            {formatMessageTime(image.timestamp)}
            {images.length > 1 && ` · ${index + 1} of ${images.length}`}
          </p>
        </div>
        <a
          href={image.url}
          download={image.filename || 'photo'}
          className="p-2 rounded-lg hover:bg-white/10"
          title="Download"
          aria-label="Download"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" title="Close" aria-label="Close">
          <Icon name="close" size={22} className="text-white" />
        </button>
      </div>

      {/* Image (click the backdrop to close, swipe to move) */}
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center px-4 pb-6"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        onPointerDown={(e) => { swipeStartX.current = e.clientX; }}
        onPointerUp={onPointerUp}
      >
        <img
          key={image.id}
          src={image.url}
          alt={image.filename || 'Photo'}
          draggable={false}
          className="max-w-full max-h-full object-contain rounded-lg shadow-elevated animate-fade-in"
        />

        {hasPrev && (
          <button
            onClick={() => onIndexChange(index - 1)}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
            title="Previous"
            aria-label="Previous image"
          >
            <Icon name="back" size={22} />
          </button>
        )}
        {hasNext && (
          <button
            onClick={() => onIndexChange(index + 1)}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
            title="Next"
            aria-label="Next image"
          >
            <Icon name="forward" size={22} />
          </button>
        )}
      </div>
    </div>
  );
};

export default MediaViewer;
