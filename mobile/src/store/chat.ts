// src/store/chat.ts
// Chats and messages, kept up to date by the WebSocket (mirrors the web app's chat slice).

import { create } from 'zustand';
import { chatApi, Conversation, Message, ReplyPreview } from '../api/chat';
import { OutgoingMedia, socket, WsEvent } from '../ws/socket';
import { LocalFile, UploadQuality, uploadFile } from '../api/media';
import { createThumbnail } from 'react-native-create-thumbnail';
import { decryptedFields, decryptMessage, mediaLabel, openText, recipientsFor, sealFor, unverifiedMessages } from '../crypto/messages';
import { encryptForUpload, rememberDecrypted } from '../crypto/media';
import type { E2EMedia } from '../crypto/e2e';
import { e2eSession } from '../crypto/session';
import { e2eService } from '../services/e2e.service';
import {
  confirmOwn, drainMailbox, forgetDirectory, forwardV2, fromLocal, isV2Marker, lastLocal, localFor, pendingFields, pointerOf, receiveLive,
  sendMediaV2, sendTextV2, v2For,
} from '../crypto/v2-platform/chat';
import type { ChatInfo } from '../crypto/v2-platform/chat';
import type { Received } from '../crypto/v2';

const TYPING_TTL_MS = 6000;

interface ChatState {
  conversations: Conversation[];
  loaded: boolean;
  messages: Record<string, Message[]>;
  hasMore: Record<string, boolean>;
  typing: Record<string, Record<string, { name?: string; until: number }>>;
  online: string[];
  connected: boolean;
  activeId: string | null;

  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  loadOlder: (conversationId: string) => Promise<void>;
  open: (conversationId: string | null) => void;
  send: (conversationId: string, text: string, me: { id: string; username: string }, replyTo?: ReplyPreview | null) => void;
  retry: (conversationId: string, clientId: string) => void;
  sendMedia: (conversationId: string, attachment: Attachment, me: { id: string; username: string }, replyTo?: ReplyPreview | null) => void;
  cancelUpload: (conversationId: string, clientId: string) => void;
  retryUpload: (clientId: string) => void;
  forward: (message: Message, conversationIds: string[]) => Promise<{ sent: number; skipped: number }>;
  setPinned: (conversationId: string, pinned: boolean) => void;
  reset: () => void;
}

// Latest message time each chat has been read up to on this phone. The server learns about
// reads a moment later, so a list refresh in between must not bring back an old unread count.
const readUpTo: Record<string, number> = {};
const markReadLocally = (conversationId: string, at = Date.now()) => {
  readUpTo[conversationId] = Math.max(readUpTo[conversationId] || 0, at);
};

const byTime = (a: Message, b: Message) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
let counter = 0;
const newClientId = () => `temp-${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useChat = create<ChatState>((set, get) => ({
  conversations: [],
  loaded: false,
  messages: {},
  hasMore: {},
  typing: {},
  online: [],
  connected: false,
  activeId: null,

  loadConversations: async () => {
    const conversations = (await chatApi.conversations()).map((c) =>
      c.unreadCount && readUpTo[c.id] && c.lastMessageTime && new Date(c.lastMessageTime).getTime() <= readUpTo[c.id]
        ? { ...c, unreadCount: 0 }
        : c,
    );
    set({ conversations, loaded: true });
    // v2 chats: the server only knows a message was sent; the preview comes from this phone's copy
    conversations.filter((c) => isV2Marker(c.lastMessage)).forEach((c) => {
      set((s) => ({ conversations: s.conversations.map((x) => (x.id === c.id ? { ...x, lastMessage: 'Encrypted message' } : x)) }));
      lastLocal(c.id).then((m) => {
        if (!m) return;
        const preview = previewOf({ ...fromLocal(m) } as Message);
        set((s) => ({ conversations: s.conversations.map((x) => (x.id === c.id ? { ...x, lastMessage: preview } : x)) }));
      }).catch(() => undefined);
    });
  },

  loadMessages: async (conversationId) => {
    const { messages, hasMore } = await chatApi.messages(conversationId);
    // keep messages still being sent
    const pending = (get().messages[conversationId] || []).filter((m) => m.id.startsWith('temp-'));
    set((s) => ({
      messages: { ...s.messages, [conversationId]: [...messages, ...pending].sort(byTime) },
      hasMore: { ...s.hasMore, [conversationId]: hasMore },
    }));
    flagUnverified(conversationId, messages);
    fillV2(conversationId, messages);
  },

  loadOlder: async (conversationId) => {
    const current = get().messages[conversationId] || [];
    const oldest = current.find((m) => !m.id.startsWith('temp-'));
    if (!oldest) return;
    const { messages, hasMore } = await chatApi.messages(conversationId, oldest.id);
    const known = new Set(current.map((m) => m.id));
    set((s) => ({
      messages: { ...s.messages, [conversationId]: [...messages.filter((m) => !known.has(m.id)), ...current] },
      hasMore: { ...s.hasMore, [conversationId]: hasMore },
    }));
    flagUnverified(conversationId, messages);
    fillV2(conversationId, messages);
  },

  open: (conversationId) => {
    const previous = get().activeId;
    if (previous && previous !== conversationId) {
      socket.leave(previous);
      // Leaving: make sure the server knows everything seen here is read
      markReadLocally(previous);
      chatApi.markRead(previous).catch(() => undefined);
    }
    set({ activeId: conversationId });
    if (!conversationId) return;
    markReadLocally(conversationId);
    socket.join(conversationId);
    set((s) => ({ conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)) }));
    chatApi.markRead(conversationId).catch(() => undefined);
  },

  send: (conversationId, text, me, replyTo) => {
    const clientId = newClientId();
    const message: Message = {
      id: clientId,
      clientId,
      conversationId,
      senderId: me.id,
      senderName: me.username,
      text,
      timestamp: new Date().toISOString(),
      status: 'sending',
      replyTo: replyTo || null,
      reactions: [],
    };
    set((s) => ({ messages: { ...s.messages, [conversationId]: [...(s.messages[conversationId] || []), message] } }));
    sendText(conversationId, clientId, text, replyTo?.id);
  },

  retry: (conversationId, clientId) => {
    const message = (get().messages[conversationId] || []).find((m) => m.id === clientId);
    if (!message) return;
    updateMessage(set, conversationId, clientId, { status: 'sending' });
    sendText(conversationId, clientId, message.text, message.replyTo?.id);
  },

  sendMedia: (conversationId, attachment, me, replyTo) => {
    const clientId = newClientId();
    const message: Message = {
      id: clientId,
      clientId,
      conversationId,
      senderId: me.id,
      senderName: me.username,
      text: attachment.caption,
      timestamp: new Date().toISOString(),
      status: 'sending',
      mediaUrl: attachment.file.uri, // local preview until the server copy arrives
      mediaType: attachment.kind,
      mediaFilename: attachment.file.name,
      mediaSize: attachment.size,
      mediaWidth: attachment.width,
      mediaHeight: attachment.height,
      mediaDuration: attachment.duration,
      uploadProgress: 0,
      replyTo: replyTo || null,
      reactions: [],
    };
    set((s) => ({ messages: { ...s.messages, [conversationId]: [...(s.messages[conversationId] || []), message] } }));
    uploads.set(clientId, { conversationId, attachment, replyTo });
    uploadAndSend(clientId);
  },

  cancelUpload: (conversationId, clientId) => {
    uploads.get(clientId)?.controller?.abort();
    uploads.delete(clientId);
    set((s) => ({ messages: { ...s.messages, [conversationId]: (s.messages[conversationId] || []).filter((m) => m.id !== clientId) } }));
  },

  retryUpload: (clientId) => uploadAndSend(clientId),

  forward: async (message, conversationIds) => {
    if (message.id.startsWith('temp-')) return { sent: 0, skipped: 0 };
    const encryptedMedia = mediaPayloadOf(message);
    const plainMedia: OutgoingMedia | undefined = message.mediaUrl && message.mediaType
      ? {
          mediaUrl: message.mediaUrl, // the server drops the link's signature and checks it's ours
          mediaType: message.mediaType,
          mediaSize: message.mediaSize,
          mediaFilename: message.mediaFilename,
          mediaThumbnail: message.mediaThumbnail,
          mediaWidth: message.mediaWidth,
          mediaHeight: message.mediaHeight,
          mediaDuration: message.mediaDuration,
        }
      : undefined;
    let sent = 0;
    let skipped = 0;
    for (const id of conversationIds) {
      const chat = chatInfo(id);
      const v2 = await v2For(chat).catch(() => null);
      const v2Pointer = pointerOf(message);
      if (v2 && (v2Pointer || !message.mediaUrl)) {
        if (await forwardV2(v2, chat, newClientId(), message.text || '', v2Pointer).catch(() => false)) sent += 1;
        continue;
      }
      if (v2Pointer) {
        skipped += 1; // a v2 file can only go to a chat that uses v2
        continue;
      }
      // Encrypted files are re-used as they are: only their key is sealed again for the new chat
      const sealed = await sealFor(id, { t: message.text || '', m: encryptedMedia });
      if (!sealed && encryptedMedia) {
        skipped += 1; // an encrypted file can't go to a chat that isn't encrypted
        continue;
      }
      const media = encryptedMedia
        ? { mediaUrl: message.mediaUrl!, mediaType: message.mediaType!, mediaThumbnail: message.mediaThumbnail }
        : plainMedia;
      if (socket.sendMessage(id, newClientId(), sealed?.text ?? (message.text || ''), undefined, media, sealed?.hasLink)) sent += 1;
    }
    return { sent, skipped };
  },

  setPinned: (conversationId, pinned) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, isPinned: pinned, pinnedAt: pinned ? new Date().toISOString() : null } : c,
      ),
    })),

  reset: () => set({ conversations: [], loaded: false, messages: {}, hasMore: {}, typing: {}, online: [], activeId: null }),
}));

type Setter = (fn: (s: ChatState) => Partial<ChatState>) => void;

/** Who is in a conversation (for encryption v2), from the chat list. */
function chatInfo(conversationId: string): ChatInfo {
  const c = useChat.getState().conversations.find((x) => x.id === conversationId);
  return { conversationId, isGroup: !!c?.isGroup, members: c?.members || [] };
}

/** Show what v2 decrypted: fill the timeline row (or edit) and the chat list preview. */
function applyV2(r: Received) {
  if (r.kind !== 'message' && r.kind !== 'edit') return;
  const set = useChat.setState as unknown as Setter;
  const m = r.message;
  const list = useChat.getState().messages[m.conv] || [];
  const row = list.find((x) => (m.serverId && x.id === m.serverId) || x.localId === m.id);
  if (row) updateMessage(set, m.conv, row.id, fromLocal(m));
  if (r.kind === 'message') {
    const f = fromLocal(m);
    set((s) => ({ conversations: s.conversations.map((c) => (c.id === m.conv ? { ...c, lastMessage: previewOf({ ...(row || {}), ...f } as Message) } : c)) }));
  }
}

/** Process this phone's v2 mailbox (after starting or reconnecting). */
export const syncV2 = () => drainMailbox((r) => applyV2(r)).catch(() => undefined);

/** v2 rows (and quoted v2 messages): fill from this phone's local database. */
function fillV2(conversationId: string, messages: Message[]) {
  const set = useChat.setState as unknown as Setter;
  for (const m of messages) {
    if (m.e2eVersion === 2 && m.e2e === 'pending') {
      localFor(m.id).then((local) => { if (local) updateMessage(set, conversationId, m.id, fromLocal(local)); }).catch(() => undefined);
    }
    if (m.replyTo && isV2Marker(m.replyTo.text)) {
      const reply = m.replyTo;
      localFor(reply.id).then((local) => {
        updateMessage(set, conversationId, m.id, { replyTo: { ...reply, text: local ? fromLocal(local).text || 'Attachment' : 'Encrypted message' } });
      }).catch(() => undefined);
    }
  }
}

/** Send a text message, end-to-end encrypted when everyone in the chat has set up encryption. */
async function sendText(conversationId: string, clientId: string, text: string, replyToId?: string) {
  const set = useChat.setState as unknown as Setter;
  // Encryption v2 when everyone in the chat has it set up; otherwise v1 (or plain) as before
  const chat = chatInfo(conversationId);
  const v2 = await v2For(chat).catch(() => null);
  if (v2) {
    updateMessage(set, conversationId, clientId, { e2eVersion: 2, localId: clientId });
    try {
      if (await sendTextV2(v2, chat, clientId, text, replyToId ? ({ id: replyToId } as ReplyPreview) : null)) return;
    } catch {
      // shown as not sent
    }
    updateMessage(set, conversationId, clientId, { status: 'failed' });
    return;
  }
  try {
    const sealed = await sealFor(conversationId, { t: text });
    if (socket.sendMessage(conversationId, clientId, sealed?.text ?? text, replyToId, undefined, sealed?.hasLink)) return;
  } catch {
    // keys out of date (reset on another device) or offline: shown as not sent
  }
  updateMessage(set, conversationId, clientId, { status: 'failed' });
}

/** Mark encrypted messages whose signature isn't from their sender's key (checked in the background). */
function flagUnverified(conversationId: string, messages: Message[]) {
  const set = useChat.setState as unknown as Setter;
  unverifiedMessages(messages)
    .then((ids) => ids.forEach((id) => updateMessage(set, conversationId, id, { e2eUnverified: true })))
    .catch(() => undefined);
}

/** The encrypted-file part of a message, to put in a new envelope (forward, edit). */
export const mediaPayloadOf = (m: Message): E2EMedia | undefined =>
  m.mediaKey && m.mediaType
    ? {
        key: m.mediaKey, type: m.mediaType, mime: m.mediaMime || 'application/octet-stream', name: m.mediaFilename,
        size: m.mediaSize, w: m.mediaWidth, h: m.mediaHeight, d: m.mediaDuration, tk: m.thumbKey,
      }
    : undefined;

// ---- attachments: upload first, then send the message by URL (same as the web app)
export interface Attachment {
  file: LocalFile;
  kind: 'image' | 'video' | 'audio' | 'file';
  caption: string;
  quality: UploadQuality;
  size?: number;
  width?: number;
  height?: number;
  duration?: number; // seconds (voice notes, videos)
}

const uploads = new Map<string, {
  conversationId: string;
  attachment: Attachment;
  replyTo?: ReplyPreview | null;
  controller?: AbortController;
  sent?: OutgoingMedia; // uploaded already: a retry only resends the message
  sealed?: { text: string; hasLink: boolean }; // encrypted chats: the envelope carrying the file's key
}>();

async function uploadAndSend(clientId: string) {
  const job = uploads.get(clientId);
  if (!job) return;
  const { conversationId, attachment, replyTo } = job;
  const set = useChat.setState as unknown as Setter;
  const controller = new AbortController();
  job.controller = controller;
  updateMessage(set, conversationId, clientId, { status: 'sending', uploadFailed: undefined, uploadProgress: 0 });
  try {
    const kind = attachment.quality === 'original' && attachment.kind !== 'audio' ? 'file' : attachment.kind;
    // Encryption v2: the file (PMV2) and its key travel only to the chat's devices
    const chat = chatInfo(conversationId);
    const v2 = job.sent ? null : await v2For(chat).catch(() => null);
    if (v2) {
      updateMessage(set, conversationId, clientId, { e2eVersion: 2, localId: clientId });
      const result = await sendMediaV2(v2, chat, clientId, attachment.file, kind, attachment.caption, {
        width: attachment.width, height: attachment.height, duration: attachment.duration, replyTo, signal: controller.signal,
        onProgress: (percent) => updateMessage(set, conversationId, clientId, { uploadProgress: Math.min(percent, 99) }),
      });
      if (result.posterUri) updateMessage(set, conversationId, clientId, { mediaThumbnail: result.posterUri, mediaWidth: result.width, mediaHeight: result.height });
      if (result.sent) {
        uploads.delete(clientId);
        updateMessage(set, conversationId, clientId, { uploadProgress: undefined });
      } else {
        updateMessage(set, conversationId, clientId, { status: 'failed', uploadFailed: true, uploadProgress: undefined });
      }
      return;
    }
    if (!job.sent && (await recipientsFor(conversationId))) {
      // End-to-end encrypted chat: encrypt the file (and a video's preview frame) on the phone.
      // The server can't compress or look at it; name, size and the key go inside the message.
      const progress = (percent: number) => updateMessage(set, conversationId, clientId, { uploadProgress: Math.min(percent, 99) });
      let posterUrl: string | undefined;
      let posterKey: string | undefined;
      let width = attachment.width;
      let height = attachment.height;
      if (kind === 'video') {
        try {
          const poster = await createThumbnail({ url: attachment.file.uri, timeStamp: 500, format: 'jpeg' });
          width = poster.width || width;
          height = poster.height || height;
          const sealedPoster = await encryptForUpload({ uri: poster.path, type: 'image/jpeg' });
          const up = await uploadFile({ uri: sealedPoster.uri, type: 'application/octet-stream', name: 'file.enc' }, { signal: controller.signal, encrypted: 'image' });
          posterUrl = up.url;
          posterKey = sealedPoster.key;
          await rememberDecrypted(up.url, sealedPoster.key, poster.path, 'image/jpeg');
          updateMessage(set, conversationId, clientId, { mediaThumbnail: poster.path, mediaWidth: width, mediaHeight: height });
        } catch {
          // no preview frame: the video still sends
        }
      }
      const sealedFile = await encryptForUpload(attachment.file);
      const uploaded = await uploadFile({ uri: sealedFile.uri, type: 'application/octet-stream', name: 'file.enc' }, {
        signal: controller.signal, onProgress: progress, encrypted: kind,
      });
      await rememberDecrypted(uploaded.url, sealedFile.key, attachment.file.uri, attachment.file.type);
      const m: E2EMedia = {
        key: sealedFile.key, type: kind, mime: attachment.file.type, name: attachment.file.name, size: sealedFile.size,
        w: width, h: height, d: attachment.duration, tk: posterKey,
      };
      const sealed = await sealFor(conversationId, { t: attachment.caption, m });
      if (!sealed) throw new Error("This chat isn't encrypted any more");
      job.sealed = sealed;
      job.sent = { mediaUrl: uploaded.url, mediaType: kind, mediaThumbnail: posterUrl };
    }
    if (!job.sent) {
      const uploaded = await uploadFile(attachment.file, {
        quality: attachment.quality,
        signal: controller.signal,
        // Past 100% the server is still compressing a video; keep the bar just short of full
        onProgress: (percent) => updateMessage(set, conversationId, clientId, { uploadProgress: Math.min(percent, 99) }),
      });
      job.sent = {
        mediaUrl: uploaded.url,
        mediaType: kind,
        mediaSize: uploaded.size,
        mediaFilename: uploaded.filename,
        // For videos the server's numbers come from the decoded frame, so they respect rotation
        mediaWidth: uploaded.width || attachment.width,
        mediaHeight: uploaded.height || attachment.height,
        mediaDuration: attachment.duration || uploaded.duration || undefined,
        mediaThumbnail: uploaded.thumbnailUrl || undefined,
      };
      if (uploaded.thumbnailSignedUrl) {
        updateMessage(set, conversationId, clientId, {
          mediaThumbnail: uploaded.thumbnailSignedUrl, mediaWidth: job.sent.mediaWidth, mediaHeight: job.sent.mediaHeight,
        });
      }
    }
    if (socket.sendMessage(conversationId, clientId, job.sealed?.text ?? attachment.caption, replyTo?.id, job.sent, job.sealed?.hasLink)) {
      uploads.delete(clientId);
      updateMessage(set, conversationId, clientId, { uploadProgress: undefined });
    } else {
      updateMessage(set, conversationId, clientId, { status: 'failed', uploadFailed: true, uploadProgress: undefined });
    }
  } catch {
    if (controller.signal.aborted) return; // cancelled
    updateMessage(set, conversationId, clientId, { status: 'failed', uploadFailed: true, uploadProgress: undefined });
  }
}

function updateMessage(set: Setter, conversationId: string, messageId: string, patch: Partial<Message>) {
  set((s) => ({
    messages: {
      ...s.messages,
      [conversationId]: (s.messages[conversationId] || []).map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
    },
  }));
}

const previewOf = (m: Message) => m.text || (m.mediaType ? mediaLabel({ type: m.mediaType, name: m.mediaFilename }) : '');

/** Listeners other screens can hook into (expenses, receipts). */
type Extra = (event: WsEvent) => void;
const extras = new Set<Extra>();
export const onServerEvent = (listener: Extra) => {
  extras.add(listener);
  return () => {
    extras.delete(listener);
  };
};

// ---- live events
// This module loads lazily (on first use, after the encryption check): the socket may already be open
useChat.setState({ connected: socket.connected });
socket.onStatus((connected) => {
  useChat.setState({ connected });
  if (connected) {
    syncV2(); // v2 packets that arrived while we were away
    const { activeId, loadConversations, loadMessages } = useChat.getState();
    loadConversations().catch(() => undefined); // catch up on anything missed while offline
    if (activeId) loadMessages(activeId).catch(() => undefined);
  }
});

socket.on((e) => {
  const set = useChat.setState as unknown as Setter;
  const state = useChat.getState();
  switch (e.type) {
    case 'message': {
      if (!e.roomId || !e.messageId) break;
      const message: Message = decryptMessage({
        id: e.messageId,
        conversationId: e.roomId,
        senderId: e.senderId || '',
        senderName: e.senderName,
        senderAvatar: e.senderAvatar,
        text: e.text || '',
        timestamp: e.timestamp || new Date().toISOString(),
        status: (e.status as Message['status']) || 'delivered',
        messageType: e.messageType,
        mediaUrl: e.mediaUrl || undefined,
        mediaType: e.mediaType || undefined,
        mediaFilename: e.mediaFilename || undefined,
        mediaSize: e.mediaSize || undefined,
        mediaThumbnail: e.mediaThumbnail || undefined,
        mediaWidth: e.mediaWidth || undefined,
        mediaHeight: e.mediaHeight || undefined,
        mediaDuration: e.mediaDuration || undefined,
        replyTo: e.replyTo || null,
        reactions: [],
        expenseId: e.expenseId || null,
      } as Message);
      const v2Row = isV2Marker(e.text);
      if (v2Row) {
        Object.assign(message, pendingFields);
        // The content comes in this phone's own packet; ours is already in the local database
        const own = !!e.clientId && e.senderId === e2eSession.userId();
        (own ? confirmOwn(e.clientId, e.messageId) : localFor(e.messageId)).then((local) => {
          if (local) updateMessage(set, e.roomId, e.messageId, fromLocal(local));
        }).catch(() => undefined);
      } else {
        flagUnverified(e.roomId, [message]);
      }
      set((s) => {
        const list = (s.messages[e.roomId] || []).filter((m) => m.id !== message.id && (!e.clientId || m.id !== e.clientId));
        const active = s.activeId === e.roomId;
        return {
          messages: s.messages[e.roomId] || active ? { ...s.messages, [e.roomId]: [...list, message].sort(byTime) } : s.messages,
          conversations: s.conversations.map((c) =>
            c.id === e.roomId
              ? {
                  ...c,
                  lastMessage: message.e2e === 'unreadable' || message.e2e === 'pending' ? 'Encrypted message' : previewOf(message),
                  lastMessageTime: message.timestamp,
                  unreadCount: active || e.clientId ? c.unreadCount : c.unreadCount + 1,
                }
              : c,
          ),
        };
      });
      if (!state.conversations.some((c) => c.id === e.roomId)) state.loadConversations().catch(() => undefined);
      if (state.activeId === e.roomId) {
        markReadLocally(e.roomId, new Date(message.timestamp).getTime());
        if (!e.clientId) socket.read(e.roomId, e.messageId);
      }
      break;
    }
    case 'error':
      if (e.roomId && e.clientId) {
        updateMessage(set, e.roomId, e.clientId, { status: 'failed', ...(uploads.has(e.clientId) ? { uploadFailed: true } : {}) });
      }
      break;
    case 'typing': {
      if (!e.roomId || !e.userId) break;
      set((s) => {
        const room = { ...(s.typing[e.roomId] || {}) };
        if (e.isTyping) room[e.userId] = { name: e.userName, until: Date.now() + TYPING_TTL_MS };
        else delete room[e.userId];
        return { typing: { ...s.typing, [e.roomId]: room } };
      });
      break;
    }
    case 'read':
      if (e.roomId && e.readUpTo) {
        const upTo = new Date(e.readUpTo).getTime();
        set((s) => ({
          messages: {
            ...s.messages,
            [e.roomId]: (s.messages[e.roomId] || []).map((m) =>
              !m.id.startsWith('temp-') && new Date(m.timestamp).getTime() <= upTo ? { ...m, status: 'read' } : m,
            ),
          },
        }));
      }
      break;
    case 'presence':
      set(() => ({ online: e.userIds || [] }));
      break;
    case 'online':
      if (e.userId) set((s) => ({ online: Array.from(new Set([...s.online, e.userId])) }));
      break;
    case 'offline':
      if (e.userId) set((s) => ({ online: s.online.filter((id) => id !== e.userId) }));
      break;
    case 'message_updated':
      if (e.roomId && e.messageId) {
        // An edited encrypted message comes as a new envelope: decrypt it with the original sender
        const senderId = (state.messages[e.roomId] || []).find((m) => m.id === e.messageId)?.senderId;
        const opened = senderId && !e.isDeleted ? openText(e.text, e.roomId, senderId) : null;
        updateMessage(set, e.roomId, e.messageId, {
          ...(opened ? decryptedFields(opened) : e.text !== undefined ? { text: e.text } : {}),
          ...(e.editedAt ? { editedAt: e.editedAt } : {}),
          ...(e.isDeleted ? { isDeleted: true, text: '', mediaUrl: undefined } : {}),
        });
        state.loadConversations().catch(() => undefined);
      }
      break;
    case 'reactions_updated':
      if (e.roomId && e.messageId) {
        updateMessage(set, e.roomId, e.messageId, {
          reactions: (e.reactions || []).map((r: any) => ({ emoji: r.emoji, userIds: r.userIds || r.user_ids || [] })),
        });
      }
      break;
    case 'conversation_pinned':
      if (e.conversationId) state.setPinned(e.conversationId, !!e.pinned);
      break;
    case 'e2e_envelope':
      if (typeof e.deviceId === 'number' && e.envelope) {
        receiveLive(e.deviceId, e.envelope).then((r) => { if (r) applyV2(r); }).catch(() => undefined);
      }
      break;
    case 'e2e_device_list':
      forgetDirectory(e.userId).catch(() => undefined);
      encryptionListeners.forEach((l) => l());
      break;
    case 'keys_changed':
      // Someone set up or reset their encryption keys
      e2eService.forgetUser(e.userId);
      encryptionListeners.forEach((l) => l());
      if (e.userId && e.userId === e2eSession.userId()) e2eSession.reportStale(); // ours, reset on another device
      break;
    case 'conversation_updated':
      if (e.conversationId) e2eService.forgetConversation(e.conversationId);
      forgetDirectory().catch(() => undefined); // members may have changed
      encryptionListeners.forEach((l) => l());
      state.loadConversations().catch(() => undefined);
      break;
    case 'conversation_created':
    case 'conversation_removed':
      state.loadConversations().catch(() => undefined);
      break;
  }
  extras.forEach((listener) => listener(e));
});

/** Someone's keys or a chat's members changed: open chats check their encryption again. */
const encryptionListeners = new Set<() => void>();
export const onEncryptionChange = (listener: () => void) => {
  encryptionListeners.add(listener);
  return () => {
    encryptionListeners.delete(listener);
  };
};

/** Names of people typing in a chat right now. */
export const typingNames = (typing: ChatState['typing'], conversationId: string) =>
  Object.values(typing[conversationId] || {})
    .filter((t) => t.until > Date.now())
    .map((t) => t.name || 'Someone');
