// src/utils/save.ts
// Save a chat's photo, video, voice note or document to the phone.
// Android: Downloads (the system shows a notification; photos/videos also appear in Gallery).
// iPhone: opens the file's preview, whose share button offers "Save Image", "Save to Files", etc.
import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { mediaUrl } from '../config';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4a: 'audio/mp4', weba: 'audio/webm',
  ogg: 'audio/ogg', mp3: 'audio/mpeg', pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const safeName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) || 'papyris-file';

export async function saveToPhone(url: string, filename: string): Promise<void> {
  const name = safeName(filename);
  const source = mediaUrl(url)!;
  const mime = MIME[name.split('.').pop()?.toLowerCase() || ''] || 'application/octet-stream';
  if (Platform.OS === 'android') {
    await ReactNativeBlobUtil.config({
      addAndroidDownloads: {
        useDownloadManager: true,
        notification: true,
        title: name,
        description: 'Saved from Papyris',
        mime,
        mediaScannable: true,
        storeInDownloads: true,
        path: `${ReactNativeBlobUtil.fs.dirs.DownloadDir}/${name}`,
      },
    }).fetch('GET', source);
    return;
  }
  const result = await ReactNativeBlobUtil.config({ fileCache: true, path: `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${name}` }).fetch('GET', source);
  await ReactNativeBlobUtil.ios.openDocument(result.path());
}
