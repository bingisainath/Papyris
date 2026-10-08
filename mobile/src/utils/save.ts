// src/utils/save.ts
// Save a chat's photo, video, voice note or document to the phone.
// Android: Downloads (the system shows a notification; photos/videos also appear in Gallery).
// iPhone: opens the file's preview, whose share button offers "Save Image", "Save to Files", etc.
import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { mediaUrl } from '../config';
import { decryptedFile } from '../crypto/media';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4a: 'audio/mp4', weba: 'audio/webm',
  ogg: 'audio/ogg', mp3: 'audio/mpeg', pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const safeName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) || 'papyris-file';

/** key/mime: end-to-end encrypted files are decrypted on the phone, then saved. */
export async function saveToPhone(url: string, filename: string, key?: string, fileMime?: string, v2?: { sha256: string; size: number }): Promise<void> {
  const name = safeName(filename);
  const source = mediaUrl(url)!;
  const mime = fileMime || MIME[name.split('.').pop()?.toLowerCase() || ''] || 'application/octet-stream';
  if (key) {
    const local = (await decryptedFile(url, key, fileMime, v2)).replace(/^file:\/\//, '');
    if (Platform.OS === 'android') {
      if (Number(Platform.Version) >= 29) {
        await ReactNativeBlobUtil.MediaCollection.copyToMediaStore({ name, parentFolder: '', mimeType: mime }, 'Download', local);
      } else {
        const target = `${ReactNativeBlobUtil.fs.dirs.DownloadDir}/${name}`;
        await ReactNativeBlobUtil.fs.cp(local, target);
        await ReactNativeBlobUtil.android.addCompleteDownload({
          title: name, description: 'Saved from Papyris', mime, path: target, showNotification: true,
        });
      }
      return;
    }
    const target = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${name}`;
    await ReactNativeBlobUtil.fs.unlink(target).catch(() => undefined);
    await ReactNativeBlobUtil.fs.cp(local, target);
    await ReactNativeBlobUtil.ios.openDocument(target);
    return;
  }
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
