// src/components/organisms/MediaPreviewModal/index.tsx

import React, { useState, useEffect } from 'react';

interface MediaPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  senderName?: string;
  timestamp?: string;
  onDownload?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  isOpen,
  onClose,
  mediaUrl,
  mediaType,
  caption,
  senderName,
  timestamp,
  onDownload,
  onNext,
  onPrev,
}) => {
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && onNext) onNext();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, onNext, onPrev]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur-md">
        <div className="flex-1">
          {senderName && (
            <div>
              <p className="text-white font-semibold">{senderName}</p>
              {timestamp && (
                <p className="text-white/70 text-sm">{new Date(timestamp).toLocaleString()}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onDownload && (
            <button
              onClick={onDownload}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              title="Download"
            >
              <span className="text-white">⬇️</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            <span className="text-white text-xl">×</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center relative p-4">
        {/* Previous Button */}
        {onPrev && (
          <button
            onClick={onPrev}
            className="absolute left-4 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors z-10"
          >
            <span className="text-white text-2xl">‹</span>
          </button>
        )}

        {/* Media Container */}
        <div
          className={`max-w-full max-h-full ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
          onClick={() => mediaType === 'image' && setIsZoomed(!isZoomed)}
        >
          {mediaType === 'image' ? (
            <img
              src={mediaUrl}
              alt="Preview"
              className={`max-w-full max-h-[calc(100vh-200px)] object-contain transition-transform duration-300 ${
                isZoomed ? 'scale-150' : 'scale-100'
              }`}
            />
          ) : (
            <video
              src={mediaUrl}
              controls
              autoPlay
              className="max-w-full max-h-[calc(100vh-200px)] object-contain"
            />
          )}
        </div>

        {/* Next Button */}
        {onNext && (
          <button
            onClick={onNext}
            className="absolute right-4 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors z-10"
          >
            <span className="text-white text-2xl">›</span>
          </button>
        )}
      </div>

      {/* Caption */}
      {caption && (
        <div className="px-6 py-4 bg-black/50 backdrop-blur-md">
          <p className="text-white">{caption}</p>
        </div>
      )}

      {/* Controls Info */}
      <div className="px-6 py-3 bg-black/50 backdrop-blur-md border-t border-white/10">
        <div className="flex items-center justify-center gap-6 text-sm text-white/70">
          {mediaType === 'image' && (
            <span className="flex items-center gap-2">
              <span>🖱️</span>
              Click to zoom
            </span>
          )}
          {(onPrev || onNext) && (
            <span className="flex items-center gap-2">
              <span>⬅️➡️</span>
              Arrow keys to navigate
            </span>
          )}
          <span className="flex items-center gap-2">
            <span>⎋</span>
            Esc to close
          </span>
        </div>
      </div>
    </div>
  );
};

export default MediaPreviewModal;