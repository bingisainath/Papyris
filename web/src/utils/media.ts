// src/utils/media.ts
import type React from 'react';
import { API_BASE_URL } from '../config/env';
import type { MediaType } from '../services/websocket.service';

// Keep in sync with backend MAX_UPLOAD_SIZE / MAX_VIDEO_UPLOAD_SIZE
const MB = 1024 * 1024;
export const MAX_SIZE: Record<MediaType, number> = {
  image: 10 * MB,
  video: 50 * MB,
  file: 10 * MB,
};

export const ACCEPTED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
].join(',');

export const mediaTypeOf = (file: File): MediaType => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'file';
};

/** Returns an error message if the file can't be sent, otherwise null. */
export const validateFile = (file: File): string | null => {
  if (!ACCEPTED_FILE_TYPES.split(',').includes(file.type)) {
    return 'This file type is not supported.';
  }
  const type = mediaTypeOf(file);
  if (file.size > MAX_SIZE[type]) {
    return `File is too large (max ${MAX_SIZE[type] / MB}MB for ${type}s).`;
  }
  return null;
};

/** Media URLs from the server are relative (/api/v1/media/...). */
export const resolveMediaUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return url;
};

export const formatFileSize = (bytes?: number | null): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
};

export const messagePreview = (
  text: string | undefined,
  mediaType?: MediaType | null,
  filename?: string | null
): string => {
  if (text) return text;
  if (mediaType === 'image') return 'Photo';
  if (mediaType === 'video') return 'Video';
  if (mediaType === 'file') return filename || 'File';
  return '';
};

export interface MediaDimensions {
  width: number;
  height: number;
}

/** Pixel size of an image or video file, or null if it can't be read in time. */
export function measureMedia(file: File, timeoutMs = 5000): Promise<MediaDimensions | null> {
  const type = mediaTypeOf(file);
  if (type === 'file') return Promise.resolve(null);

  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const done = (dims: MediaDimensions | null) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(dims && dims.width > 0 && dims.height > 0 ? dims : null);
    };
    const timer = setTimeout(() => done(null), timeoutMs);

    if (type === 'image') {
      const img = new Image();
      img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => done(null);
      img.src = url;
    } else {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.onloadedmetadata = () => done({ width: video.videoWidth, height: video.videoHeight });
      video.onerror = () => done(null);
      video.src = url;
    }
  });
}

/**
 * A JPEG poster frame from early in a video (shown before it's played),
 * or null if the browser can't decode it.
 */
export function captureVideoPoster(file: File, maxSide = 640, timeoutMs = 8000): Promise<File | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const done = (poster: File | null) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(poster);
    };
    const timer = setTimeout(() => done(null), timeoutMs);

    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.onloadeddata = () => {
      // Skip a possibly black first frame
      video.currentTime = Math.min(0.5, (video.duration || 1) / 4);
    };
    video.onseeked = () => {
      const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) return done(null);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        blob => done(blob ? new File([blob], 'poster.jpg', { type: 'image/jpeg' }) : null),
        'image/jpeg',
        0.8
      );
    };
    video.onerror = () => done(null);
    video.src = url;
  });
}

/** CSS size for a media box: keeps the aspect ratio within maxWidth x maxHeight. */
export function mediaBoxStyle(
  width: number | undefined,
  height: number | undefined,
  maxWidth = 320,
  maxHeight = 256
): React.CSSProperties | undefined {
  if (!width || !height) return undefined;
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.round(width * scale),
    aspectRatio: `${width} / ${height}`,
    maxWidth: '100%',
  };
}
