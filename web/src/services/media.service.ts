// src/services/media.service.ts
import api from '../utils/axios';
import type { MediaType } from './websocket.service';
import type { UploadQuality } from '../utils/media';

export interface UploadedMedia {
  url: string; // plain URL: send this in messages / profile / group updates
  signedUrl: string; // expiring URL for displaying the file
  mediaType: MediaType;
  mimeType: string;
  size: number;
  filename: string;
  width?: number | null;
  height?: number | null;
  /** Videos: poster frame made by the server, and the length in seconds */
  thumbnailUrl?: string | null;
  thumbnailSignedUrl?: string | null;
  duration?: number | null;
}

class MediaService {
  /**
   * Upload a file to the Papyris server. The returned URL is then sent in a chat message.
   */
  async upload(
    file: File,
    onProgress?: (percent: number) => void,
    // encrypted: the file is end-to-end encrypted (crypto/media.ts); say what kind it is
    options: { signal?: AbortSignal; quality?: UploadQuality; encrypted?: 'image' | 'video' | 'audio' | 'file' | 'backup' } = {},
  ): Promise<UploadedMedia> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/api/v1/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: options.encrypted
        ? { encrypted: true, kind: options.encrypted }
        : options.quality ? { quality: options.quality } : undefined,
      signal: options.signal,
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    });
    return response.data.data;
  }
}

export const mediaService = new MediaService();
