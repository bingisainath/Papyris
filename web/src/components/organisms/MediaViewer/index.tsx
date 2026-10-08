// src/components/organisms/MediaViewer/index.tsx
// Full-screen viewer for a conversation's photos and videos (swipe or arrow keys to move).

import React, { useEffect, useRef } from 'react';
import { Download, Forward } from 'lucide-react';
import { toast } from 'react-toastify';
import Icon from '../../atoms/Icon';
import { downloadMedia } from '../../../utils/media';
import { downloadDecrypted, useMediaSrc } from '../../../crypto/media';
import { Lock } from 'lucide-react';
import { formatMessageTime } from '../../../utils/dateFormat';

export interface ViewerImage {
  id: string;
  url: string;
  filename?: string;
  senderName?: string;
  timestamp: string;
  type?: 'image' | 'video';
  mediaKey?: string; // end-to-end encrypted: decrypted in the browser
  mediaMime?: string;
}

interface MediaViewerProps {
  images: ViewerImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onForward?: (id: string) => void;
}

const MediaViewer: React.FC<MediaViewerProps> = ({ images, index, onIndexChange, onClose, onForward }) => {
  const image = images[index];
  const swipeStartX = useRef<number | null>(null);
  const media = useMediaSrc(image?.url, image?.mediaKey, image?.mediaMime);
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
      aria-label="Media viewer"
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
        {onForward && (
          <button onClick={() => onForward(image.id)} className="p-2 rounded-lg hover:bg-white/10" title="Forward" aria-label="Forward">
            <Forward className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={() => {
            const name = image.filename || (image.type === 'video' ? 'video.mp4' : 'photo.jpg');
            (image.mediaKey ? downloadDecrypted(image.url, image.mediaKey, image.mediaMime, name) : downloadMedia(image.url, name))
              .catch(() => toast.error("Couldn't download it. Try again"));
          }}
          className="p-2 rounded-lg hover:bg-white/10"
          title="Download"
          aria-label="Download"
        >
          <Download className="w-5 h-5" />
        </button>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" title="Close" aria-label="Close">
          <Icon name="close" size={22} className="text-white" />
        </button>
      </div>

      {/* Image (click the backdrop to close, swipe to move) */}
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center px-4 pb-6"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        onPointerDown={(e) => { swipeStartX.current = (e.target as HTMLElement).tagName === 'VIDEO' ? null : e.clientX; }} // video controls need drags
        onPointerUp={onPointerUp}
      >
        {!media.src ? (
          <p className="flex items-center gap-2 text-sm text-white/70">
            <Lock className="w-4 h-4 animate-pulse" /> {media.failed ? "Couldn't decrypt this photo" : 'Decrypting…'}
          </p>
        ) : image.type === 'video' ? (
          <video key={image.id} src={media.src} controls autoPlay playsInline className="max-w-full max-h-full rounded-lg bg-black" />
        ) : (
          <img
            key={image.id}
            src={media.src}
            alt={image.filename || 'Photo'}
            draggable={false}
            className="max-w-full max-h-full object-contain rounded-lg shadow-elevated animate-fade-in"
          />
        )}

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
