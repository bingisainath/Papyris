// src/utils/media.ts
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
  if (mediaType === 'image') return '📷 Photo';
  if (mediaType === 'video') return '🎥 Video';
  if (mediaType === 'file') return filename ? `📎 ${filename}` : '📎 File';
  return '';
};
