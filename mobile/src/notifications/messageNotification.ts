// src/notifications/messageNotification.ts
// Chat notifications that show what the message says. Messages are end-to-end encrypted, so the
// server only sends "a message came" (a data-only push, backend/app/services/push.py); this phone
// fetches its own encrypted copy, decrypts it and shows the notification itself
// (android/app/.../NotificationsModule.kt). Runs while the app is in the background or closed.
// If the message can't be read in time, the server's text ("New message", "Photo") is shown instead.

import { NativeModules } from 'react-native';
import { jwtDecode } from 'jwt-decode';
import { tokens } from '../api/tokens';
import { fromLocal, localFor } from '../crypto/v2-platform/chat';
import { startV2IfSetUp, v2Runtime } from '../crypto/v2-platform/runtime';
import { mediaLabel } from '../crypto/messages';
import { syncV2 } from '../store/chat'; // also updates the screens if the app is open in the background

const DECRYPT_TIMEOUT_MS = 8000;
const RETRY_MS = 1500;

export type PushData = Record<string, string | object | undefined>;

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** What the server could say: its body without the "sender: " it puts in front in groups. */
export function serverPreview(data: PushData): string {
  const body = str(data.body);
  const sender = str(data.sender);
  return str(data.chat) && sender && body.startsWith(`${sender}: `) ? body.slice(sender.length + 2) : body || 'New message';
}

/** Show a chat notification for this push (data-only, type "message"). */
export async function showMessageNotification(data: PushData): Promise<void> {
  const shade = NativeModules.ShareEvenNotifications;
  const conversationId = str(data.conversationId);
  if (str(data.type) !== 'message' || !conversationId || !shade?.showMessage) return;
  let text = serverPreview(data);
  if (str(data.encrypted) && !str(data.hideText) && str(data.messageId)) {
    text = (await withTimeout(decryptedPreview(str(data.messageId)), DECRYPT_TIMEOUT_MS).catch(() => null)) || text;
  }
  shade.showMessage({ conversationId, sender: str(data.sender), text, chat: str(data.chat) });
}

/** This phone's copy of a message (fetched from its mailbox now if needed), as notification text. */
async function decryptedPreview(messageId: string): Promise<string | null> {
  if (!(await encryptionReady())) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise<void>((r) => setTimeout(r, RETRY_MS)); // its packet may not be stored yet
    await syncV2();
    const local = await localFor(messageId);
    if (local) {
      const m = fromLocal(local);
      return m.text || (m.mediaType ? mediaLabel({ type: m.mediaType, name: m.mediaFilename }) : null);
    }
  }
  return null;
}

/** The app was closed: sign in from the saved session and open this phone's keys (if it has them). */
async function encryptionReady(): Promise<boolean> {
  if (v2Runtime()) return !!(await v2Runtime()!.catch(() => null));
  if (!tokens.access && !(await tokens.load())) return false;
  const userId = jwtDecode<{ sub?: string }>(tokens.access!).sub;
  return !!userId && !!(await startV2IfSetUp(userId).catch(() => null));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}
