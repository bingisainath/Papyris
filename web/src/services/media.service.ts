// src/services/media.service.ts
import api from '../utils/axios';
import type { MediaType } from './websocket.service';

export interface UploadedMedia {
  url: string;
  mediaType: MediaType;
  mimeType: string;
  size: number;
  filename: string;
}

class MediaService {
  /**
   * Upload a file to the Papyris server. The returned URL is then sent in a chat message.
   */
  async upload(file: File, onProgress?: (percent: number) => void): Promise<UploadedMedia> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/api/v1/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
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
