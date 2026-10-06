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
}

class MediaService {
  /**
   * Upload a file to the Papyris server. The returned URL is then sent in a chat message.
   */
  async upload(
    file: File,
    onProgress?: (percent: number) => void,
    options: { signal?: AbortSignal; quality?: UploadQuality } = {},
  ): Promise<UploadedMedia> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/api/v1/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: options.quality ? { quality: options.quality } : undefined,
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
