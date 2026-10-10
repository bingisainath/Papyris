// src/crypto/v2-platform/chat.ts
// Encryption v2 in the phone's chat screens (phase 4), same rules as web/src/crypto/v2-platform/chat.ts:
// a conversation uses v2 once every member has a v2 device list and this phone is on its account's
// list; otherwise sending stays on v1 as before.

import { createThumbnail } from 'react-native-create-thumbnail';
import { api } from '../../api/client';
import { uploadFile } from '../../api/media';
import type { LocalFile } from '../../api/media';
import type { Message, ReplyPreview } from '../../api/chat';
import { socket } from '../../ws/socket';
import { isV2Marker, LocalMessage, MediaPointer, MessageBody } from '../v2';
import type { IncomingEnvelope, OutgoingEnvelope, Received } from '../v2';
import { encryptFileV2, rememberDecrypted } from '../media';
import { v2Runtime } from './runtime';

const LINK_RE = /https?:\/\/\S/i;

export { isV2Marker };

export interface ChatInfo { conversationId: string; isGroup: boolean; members: string[] }
type V2 = NonNullable<Awaited<ReturnType<typeof v2For>>>;

export async function v2For(chat: ChatInfo) {
  const runtime = await v2Runtime()?.catch(() => null);
  if (!runtime?.state.listed || !chat.members.length) return null;
  const members = Array.from(new Set([...chat.members, runtime.userId]));
  return (await runtime.messenger.ready(members).catch(() => false)) ? { runtime, members } : null;
}

const typeOf = (p: MediaPointer): Message['mediaType'] => p.type || (p.mime.startsWith('image/') ? 'image' : p.mime.startsWith('video/') ? 'video' : p.mime.startsWith('audio/') ? 'audio' : 'file');

export function fromLocal(m: LocalMessage): Partial<Message> {
  const p = m.media?.[0];
  return {
    text: m.deleted ? '' : m.text || '',
    e2e: 'encrypted',
    e2eVersion: 2,
    localId: m.id,
    isDeleted: m.deleted || undefined,
    editedAt: m.editedAt ? new Date(m.editedAt).toISOString() : undefined,
    ...(p ? {
      mediaType: typeOf(p), mediaKey: p.key, mediaMime: p.mime, mediaFilename: p.name, mediaSize: p.size,
      mediaWidth: p.w, mediaHeight: p.h, mediaDuration: p.dur, mediaV2: { sha256: p.sha256, size: p.size },
      ...(p.thumb ? { thumbKey: p.thumb.key, thumbV2: { sha256: p.thumb.sha256, size: p.thumb.size } } : {}),
    } : {}),
  };
}

export const pendingFields: Partial<Message> = { text: '', e2e: 'pending', e2eVersion: 2 };

export async function localFor(serverId: string): Promise<LocalMessage | null> {
  const runtime = await v2Runtime()?.catch(() => null);
  return runtime ? runtime.messenger.byServerId(serverId) : null;
}

/**
 * When this phone joined the account's devices (0 if unknown). Messages sent before then were never
 * encrypted for it: unless the history brought them, they can't be read here.
 */
export async function joinedAt(): Promise<number> {
  const runtime = await v2Runtime()?.catch(() => null);
  return (runtime && (await runtime.store.setting<number>('joinedAt'))) || 0;
}

/** Search this phone's encrypted message database (end-to-end encrypted chats). */
export async function searchLocal(query: string, conversationId?: string): Promise<LocalMessage[]> {
  const runtime = await v2Runtime()?.catch(() => null);
  return runtime ? runtime.store.searchMessages(query, { conv: conversationId }) : [];
}

export async function lastLocal(conversationId: string): Promise<LocalMessage | null> {
  const runtime = await v2Runtime()?.catch(() => null);
  return runtime ? runtime.store.lastMessage(conversationId) : null;
}

function sendOverSocket(chat: ChatInfo, clientId: string, deviceId: number, messageType: string, envelopes: OutgoingEnvelope[], extra: { attachments?: string[]; replyToId?: string; hasLink?: boolean }) {
  return socket.send({
    type: 'message_v2', roomId: chat.conversationId, clientId, fromDevice: deviceId, messageType,
    envelopes, attachments: extra.attachments || [], ...(extra.replyToId ? { replyToId: extra.replyToId } : {}), hasLink: !!extra.hasLink,
  });
}

const me = (v2: V2) => ({ user: v2.runtime.userId, device: v2.runtime.state.deviceId });

export async function sendTextV2(v2: V2, chat: ChatInfo, clientId: string, text: string, replyTo?: ReplyPreview | null): Promise<boolean> {
  const body: MessageBody = { v: 2, id: clientId, conv: chat.conversationId, ts: Date.now(), kind: 'text', text, ...(replyTo ? { replyTo: replyTo.id } : {}) };
  const envelopes = await v2.runtime.messenger.encrypt(chat.conversationId, chat.isGroup, v2.members, body);
  await v2.runtime.messenger.rememberSent({ id: clientId, conv: chat.conversationId, sender: me(v2), ts: body.ts, kind: 'text', text, replyTo: body.replyTo, status: 'sending' });
  return sendOverSocket(chat, clientId, v2.runtime.state.deviceId, 'text', envelopes, { replyToId: replyTo?.id, hasLink: LINK_RE.test(text) });
}

async function uploadV2(file: { uri: string; type: string }, kind: 'image' | 'video' | 'audio' | 'file', onProgress?: (p: number) => void, signal?: AbortSignal) {
  const sealed = await encryptFileV2(file);
  const uploaded = await uploadFile({ uri: sealed.uri, type: 'application/octet-stream', name: 'file.enc' }, { encrypted: kind, onProgress, signal });
  await rememberDecrypted(uploaded.url, sealed.key, file.uri, file.type);
  return { url: uploaded.url, key: sealed.key, sha256: sealed.sha256, size: sealed.size };
}

export async function sendMediaV2(
  v2: V2, chat: ChatInfo, clientId: string, file: LocalFile, kind: 'image' | 'video' | 'audio' | 'file', caption: string,
  options: { width?: number; height?: number; duration?: number; replyTo?: ReplyPreview | null; signal?: AbortSignal; onProgress?: (p: number) => void },
): Promise<{ sent: boolean; posterUri?: string; width?: number; height?: number }> {
  let thumb: MediaPointer['thumb'];
  let width = options.width;
  let height = options.height;
  let posterUri: string | undefined;
  if (kind === 'video') {
    try {
      const poster = await createThumbnail({ url: file.uri, timeStamp: 500, format: 'jpeg' });
      width = poster.width || width;
      height = poster.height || height;
      posterUri = poster.path;
      const t = await uploadV2({ uri: poster.path, type: 'image/jpeg' }, 'image', undefined, options.signal);
      thumb = { url: t.url, key: t.key, sha256: t.sha256, size: t.size, mime: 'image/jpeg' };
    } catch {
      // no preview frame: the video still sends
    }
  }
  const main = await uploadV2(file, kind, options.onProgress, options.signal);
  const pointer: MediaPointer = {
    url: main.url, key: main.key, sha256: main.sha256, size: main.size, mime: file.type, type: kind, name: file.name,
    w: width, h: height, dur: options.duration, thumb,
  };
  const body: MessageBody = { v: 2, id: clientId, conv: chat.conversationId, ts: Date.now(), kind: 'media', text: caption, media: [pointer], ...(options.replyTo ? { replyTo: options.replyTo.id } : {}) };
  const envelopes = await v2.runtime.messenger.encrypt(chat.conversationId, chat.isGroup, v2.members, body);
  await v2.runtime.messenger.rememberSent({ id: clientId, conv: chat.conversationId, sender: me(v2), ts: body.ts, kind: 'media', text: caption, media: [pointer], replyTo: body.replyTo, status: 'sending' });
  const sent = sendOverSocket(chat, clientId, v2.runtime.state.deviceId, kind, envelopes, {
    attachments: [main.url, ...(thumb ? [thumb.url] : [])], replyToId: options.replyTo?.id, hasLink: LINK_RE.test(caption),
  });
  return { sent, posterUri, width, height };
}

export async function forwardV2(v2: V2, chat: ChatInfo, clientId: string, text: string, pointer?: MediaPointer): Promise<boolean> {
  const body: MessageBody = { v: 2, id: clientId, conv: chat.conversationId, ts: Date.now(), kind: pointer ? 'media' : 'text', text, ...(pointer ? { media: [pointer] } : {}) };
  const envelopes = await v2.runtime.messenger.encrypt(chat.conversationId, chat.isGroup, v2.members, body);
  await v2.runtime.messenger.rememberSent({ id: clientId, conv: chat.conversationId, sender: me(v2), ts: body.ts, kind: body.kind as 'text' | 'media', text, media: body.media, status: 'sending' });
  return sendOverSocket(chat, clientId, v2.runtime.state.deviceId, pointer ? (pointer.type || 'file') : 'text', envelopes, {
    attachments: pointer ? [pointer.url, ...(pointer.thumb ? [pointer.thumb.url] : [])] : [], hasLink: LINK_RE.test(text),
  });
}

const plainUrl = (u: string) => u.split('?')[0].replace(/^https?:\/\/[^/]+/, '');

export function pointerOf(m: Message): MediaPointer | undefined {
  if (m.e2eVersion !== 2 || !m.mediaKey || !m.mediaV2 || !m.mediaUrl) return undefined;
  return {
    url: plainUrl(m.mediaUrl), key: m.mediaKey, sha256: m.mediaV2.sha256, size: m.mediaV2.size,
    mime: m.mediaMime || 'application/octet-stream', type: m.mediaType, name: m.mediaFilename, w: m.mediaWidth, h: m.mediaHeight, dur: m.mediaDuration,
    ...(m.thumbKey && m.thumbV2 && m.mediaThumbnail ? { thumb: { url: plainUrl(m.mediaThumbnail), key: m.thumbKey, sha256: m.thumbV2.sha256, size: m.thumbV2.size, mime: 'image/jpeg' } } : {}),
  };
}

export async function editV2(chat: ChatInfo, message: Message, text: string): Promise<void> {
  const v2 = await v2For(chat);
  if (!v2 || !message.localId) throw new Error("Can't edit this message from this phone");
  const local = await v2.runtime.store.message(message.localId);
  const rev = (local?.rev ?? 0) + 1;
  const envelopes = await v2.runtime.messenger.encryptEdit(chat.conversationId, chat.isGroup, v2.members, message.localId, rev, text);
  await api.post(`/e2e/v2/conversations/${chat.conversationId}/envelopes`, {
    from_device: v2.runtime.state.deviceId, message_id: message.id.startsWith('temp-') ? undefined : message.id, packets: envelopes,
  });
  await v2.runtime.store.transaction((tx) => tx.editMessage(message.localId!, rev, text, Date.now()));
}

export async function confirmOwn(clientId: string, serverId: string): Promise<LocalMessage | null> {
  const runtime = await v2Runtime()?.catch(() => null);
  return runtime ? runtime.messenger.confirmSent(clientId, serverId) : null;
}

export async function receiveLive(deviceId: number, envelope: IncomingEnvelope): Promise<Received | null> {
  const runtime = await v2Runtime()?.catch(() => null);
  if (!runtime || deviceId !== runtime.state.deviceId) return null;
  const result = await runtime.messenger.receive(envelope);
  if (result.kind !== 'waiting') await runtime.messenger.ack([envelope.id]).catch(() => undefined);
  return result;
}

export async function drainMailbox(onReceived: (r: Received, e: IncomingEnvelope) => void): Promise<void> {
  const runtime = await v2Runtime()?.catch(() => null);
  if (!runtime?.state.listed) return;
  await runtime.messenger.drain(onReceived);
}

export async function forgetDirectory(user?: string): Promise<void> {
  const runtime = await v2Runtime()?.catch(() => null);
  runtime?.messenger.forget(user);
}
