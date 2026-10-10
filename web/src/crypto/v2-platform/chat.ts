// src/crypto/v2-platform/chat.ts
// Encryption v2 in the chat screens (phase 4): decides per conversation whether to send with v2,
// sends and receives through the Messenger, and turns local v2 messages into chat messages.
// A conversation uses v2 once every member has a v2 device list and this browser is on its
// account's list; otherwise sending stays on v1 (crypto/messages.ts) as before.

import api from '../../utils/axios';
import { mediaService } from '../../services/media.service';
import { wsService } from '../../services/websocket.service';
import { captureVideoPoster, compressImage, measureMedia, mediaTypeOf } from '../../utils/media';
import type { UploadQuality } from '../../utils/media';
import type { Message, ReplyPreview } from '../../redux/slices/chatSlice';
import { encryptMedia, isV2Marker, LocalMessage, MediaPointer, MessageBody } from '../v2';
import type { IncomingEnvelope, OutgoingEnvelope, Received } from '../v2';
import { rememberDecrypted } from '../media';
import { v2Runtime } from './runtime';

const LINK_RE = /https?:\/\/\S/i;

export { isV2Marker };

export interface ChatInfo { conversationId: string; isGroup: boolean; members: string[] }

/** The running v2 messenger if this browser can send with v2 in this chat, else null. */
export async function v2For(chat: ChatInfo) {
  const runtime = await v2Runtime()?.catch(() => null);
  if (!runtime?.state.listed || !chat.members.length) return null;
  const members = Array.from(new Set([...chat.members, runtime.userId]));
  return (await runtime.messenger.ready(members).catch(() => false)) ? { runtime, members } : null;
}

const typeOf = (p: MediaPointer): Message['mediaType'] => p.type || (p.mime.startsWith('image/') ? 'image' : p.mime.startsWith('video/') ? 'video' : p.mime.startsWith('audio/') ? 'audio' : 'file');

/** Chat-message fields from a local v2 message (text, media pointer, reply, edit state). */
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

/** What a v2 timeline row shows until (or unless) this device can decrypt it. */
export const pendingFields: Partial<Message> = { text: '', e2e: 'pending', e2eVersion: 2 };

/** Fill a timeline row (server copy) from this device's local database, if it has it. */
export async function localFor(serverId: string): Promise<LocalMessage | null> {
  const runtime = await v2Runtime()?.catch(() => null);
  return runtime ? runtime.messenger.byServerId(serverId) : null;
}

/**
 * When this browser joined the account's devices (0 if unknown). Messages sent before then were never
 * encrypted for it: unless the history brought them, they can't be read here.
 */
export async function joinedAt(): Promise<number> {
  const runtime = await v2Runtime()?.catch(() => null);
  return (runtime && (await runtime.store.setting<number>('joinedAt'))) || 0;
}

/** Search this browser's encrypted message database (end-to-end encrypted chats). */
export async function searchLocal(query: string, conversationId?: string): Promise<LocalMessage[]> {
  const runtime = await v2Runtime()?.catch(() => null);
  return runtime ? runtime.store.searchMessages(query, { conv: conversationId }) : [];
}

export async function lastLocal(conversationId: string): Promise<LocalMessage | null> {
  const runtime = await v2Runtime()?.catch(() => null);
  return runtime ? runtime.store.lastMessage(conversationId) : null;
}

function sendOverSocket(chat: ChatInfo, clientId: string, deviceId: number, messageType: string, envelopes: OutgoingEnvelope[], extra: { attachments?: string[]; replyToId?: string; hasLink?: boolean }) {
  return wsService.sendEvent({
    type: 'message_v2', roomId: chat.conversationId, clientId, fromDevice: deviceId, messageType,
    envelopes, attachments: extra.attachments || [], ...(extra.replyToId ? { replyToId: extra.replyToId } : {}), hasLink: !!extra.hasLink,
  });
}

/** Send a text message with v2. Returns false if the socket is down. */
export async function sendTextV2(v2: NonNullable<Awaited<ReturnType<typeof v2For>>>, chat: ChatInfo, clientId: string, text: string, replyTo?: ReplyPreview | null): Promise<boolean> {
  const { runtime, members } = v2;
  const body: MessageBody = { v: 2, id: clientId, conv: chat.conversationId, ts: Date.now(), kind: 'text', text, ...(replyTo ? { replyTo: replyTo.id } : {}) };
  const envelopes = await runtime.messenger.encrypt(chat.conversationId, chat.isGroup, members, body);
  await runtime.messenger.rememberSent({ id: clientId, conv: chat.conversationId, sender: { user: runtime.userId, device: runtime.state.deviceId }, ts: body.ts, kind: 'text', text, replyTo: body.replyTo, status: 'sending' });
  return sendOverSocket(chat, clientId, runtime.state.deviceId, 'text', envelopes, { replyToId: replyTo?.id, hasLink: LINK_RE.test(text) });
}

/** Encrypt a file (PMV2) and upload it. */
async function uploadV2(file: Blob, kind: 'image' | 'video' | 'audio' | 'file', onProgress?: (p: number) => void, signal?: AbortSignal) {
  const sealed = encryptMedia(new Uint8Array(await file.arrayBuffer()));
  const uploaded = await mediaService.upload(new File([sealed.blob], 'file.enc', { type: 'application/octet-stream' }), onProgress, { signal, encrypted: kind });
  return { url: uploaded.url, key: sealed.key, sha256: sealed.sha256, size: sealed.size };
}

/** Send a photo, video, voice note or document with v2. */
export async function sendMediaV2(
  v2: NonNullable<Awaited<ReturnType<typeof v2For>>>, chat: ChatInfo, clientId: string, file: File, caption: string,
  options: { quality?: UploadQuality; duration?: number; replyTo?: ReplyPreview | null; signal?: AbortSignal; onProgress?: (p: number) => void },
): Promise<boolean> {
  const { runtime, members } = v2;
  const quality = options.quality || 'standard';
  const kind = quality === 'original' && mediaTypeOf(file) !== 'audio' ? 'file' : mediaTypeOf(file);
  const prepared = kind === 'image' ? await compressImage(file, quality) : file;
  const [dims, poster] = await Promise.all([
    kind === 'image' || kind === 'video' ? measureMedia(file) : Promise.resolve(null),
    kind === 'video' ? captureVideoPoster(file) : Promise.resolve(null),
  ]);
  const main = await uploadV2(prepared, kind, options.onProgress, options.signal);
  rememberDecrypted(main.url, main.key, prepared);
  let thumb: MediaPointer['thumb'];
  if (poster) {
    const t = await uploadV2(poster, 'image', undefined, options.signal);
    rememberDecrypted(t.url, t.key, poster);
    thumb = { url: t.url, key: t.key, sha256: t.sha256, size: t.size, mime: 'image/jpeg' };
  }
  const pointer: MediaPointer = {
    url: main.url, key: main.key, sha256: main.sha256, size: main.size, mime: prepared.type || 'application/octet-stream', type: kind,
    name: (prepared as File).name || file.name, w: dims?.width, h: dims?.height, dur: options.duration, thumb,
  };
  const body: MessageBody = { v: 2, id: clientId, conv: chat.conversationId, ts: Date.now(), kind: 'media', text: caption, media: [pointer], ...(options.replyTo ? { replyTo: options.replyTo.id } : {}) };
  const envelopes = await runtime.messenger.encrypt(chat.conversationId, chat.isGroup, members, body);
  await runtime.messenger.rememberSent({ id: clientId, conv: chat.conversationId, sender: { user: runtime.userId, device: runtime.state.deviceId }, ts: body.ts, kind: 'media', text: caption, media: [pointer], replyTo: body.replyTo, status: 'sending' });
  return sendOverSocket(chat, clientId, runtime.state.deviceId, kind, envelopes, {
    attachments: [main.url, ...(thumb ? [thumb.url] : [])], replyToId: options.replyTo?.id, hasLink: LINK_RE.test(caption),
  });
}

/** Forward an existing v2 or plain message into a v2 chat (files are reused: only their key is sealed again). */
export async function forwardV2(v2: NonNullable<Awaited<ReturnType<typeof v2For>>>, chat: ChatInfo, clientId: string, text: string, pointer?: MediaPointer): Promise<boolean> {
  const { runtime, members } = v2;
  const body: MessageBody = { v: 2, id: clientId, conv: chat.conversationId, ts: Date.now(), kind: pointer ? 'media' : 'text', text, ...(pointer ? { media: [pointer] } : {}) };
  const envelopes = await runtime.messenger.encrypt(chat.conversationId, chat.isGroup, members, body);
  await runtime.messenger.rememberSent({ id: clientId, conv: chat.conversationId, sender: { user: runtime.userId, device: runtime.state.deviceId }, ts: body.ts, kind: body.kind as 'text' | 'media', text, media: body.media, status: 'sending' });
  return sendOverSocket(chat, clientId, runtime.state.deviceId, pointer ? (pointer.type || 'file') : 'text', envelopes, {
    attachments: pointer ? [pointer.url, ...(pointer.thumb ? [pointer.thumb.url] : [])] : [], hasLink: LINK_RE.test(text),
  });
}

/** The v2 media pointer of a chat message (to forward it). */
export function pointerOf(m: Message): MediaPointer | undefined {
  if (m.e2eVersion !== 2 || !m.mediaKey || !m.mediaV2 || !m.mediaUrl) return undefined;
  return {
    url: m.mediaUrl.split('?')[0].replace(/^https?:\/\/[^/]+/, ''), key: m.mediaKey, sha256: m.mediaV2.sha256, size: m.mediaV2.size,
    mime: m.mediaMime || 'application/octet-stream', type: m.mediaType, name: m.mediaFilename, w: m.mediaWidth, h: m.mediaHeight, dur: m.mediaDuration,
    ...(m.thumbKey && m.thumbV2 && m.mediaThumbnail ? { thumb: { url: m.mediaThumbnail.split('?')[0].replace(/^https?:\/\/[^/]+/, ''), key: m.thumbKey, sha256: m.thumbV2.sha256, size: m.thumbV2.size, mime: 'image/jpeg' } } : {}),
  };
}

/** Edit a v2 message: a follow-up packet to the same devices (the timeline row stays as it is). */
export async function editV2(chat: ChatInfo, message: Message, text: string): Promise<void> {
  const v2 = await v2For(chat);
  if (!v2 || !message.localId) throw new Error("Can't edit this message from this browser");
  const local = await v2.runtime.store.message(message.localId);
  const rev = (local?.rev ?? 0) + 1;
  const envelopes = await v2.runtime.messenger.encryptEdit(chat.conversationId, chat.isGroup, v2.members, message.localId, rev, text);
  await api.post(`/api/v1/e2e/v2/conversations/${chat.conversationId}/envelopes`, {
    from_device: v2.runtime.state.deviceId, message_id: message.id.startsWith('temp-') ? undefined : message.id, packets: envelopes,
  });
  await v2.runtime.store.transaction((tx) => tx.editMessage(message.localId!, rev, text, Date.now()));
}

/** Our message came back from the server: link our local copy to the timeline row. */
export async function confirmOwn(clientId: string, serverId: string): Promise<LocalMessage | null> {
  const runtime = await v2Runtime()?.catch(() => null);
  return runtime ? runtime.messenger.confirmSent(clientId, serverId) : null;
}

/** Process one envelope that arrived over the WebSocket (if it's for this browser). */
export async function receiveLive(deviceId: number, envelope: IncomingEnvelope): Promise<Received | null> {
  const runtime = await v2Runtime()?.catch(() => null);
  if (!runtime || deviceId !== runtime.state.deviceId) return null;
  const result = await runtime.messenger.receive(envelope);
  if (result.kind !== 'waiting') await runtime.messenger.ack([envelope.id]).catch(() => undefined);
  return result;
}

/** Process everything waiting in this browser's mailbox (after starting or reconnecting). */
export async function drainMailbox(onReceived: (r: Received, e: IncomingEnvelope) => void): Promise<void> {
  const runtime = await v2Runtime()?.catch(() => null);
  if (!runtime?.state.listed) return;
  await runtime.messenger.drain(onReceived);
}

/** A device list or a chat's members changed. */
export async function forgetDirectory(user?: string): Promise<void> {
  const runtime = await v2Runtime()?.catch(() => null);
  runtime?.messenger.forget(user);
}
