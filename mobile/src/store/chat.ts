// src/store/chat.ts
// Chats and messages, kept up to date by the WebSocket (mirrors the web app's chat slice).

import { create } from 'zustand';
import { chatApi, Conversation, Message, ReplyPreview } from '../api/chat';
import { socket, WsEvent } from '../ws/socket';

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
  },

  loadMessages: async (conversationId) => {
    const { messages, hasMore } = await chatApi.messages(conversationId);
    // keep messages still being sent
    const pending = (get().messages[conversationId] || []).filter((m) => m.id.startsWith('temp-'));
    set((s) => ({
      messages: { ...s.messages, [conversationId]: [...messages, ...pending].sort(byTime) },
      hasMore: { ...s.hasMore, [conversationId]: hasMore },
    }));
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
    if (!socket.sendMessage(conversationId, clientId, text, replyTo?.id)) {
      updateMessage(set, conversationId, clientId, { status: 'failed' });
    }
  },

  retry: (conversationId, clientId) => {
    const message = (get().messages[conversationId] || []).find((m) => m.id === clientId);
    if (!message) return;
    updateMessage(set, conversationId, clientId, { status: 'sending' });
    if (!socket.sendMessage(conversationId, clientId, message.text, message.replyTo?.id)) {
      updateMessage(set, conversationId, clientId, { status: 'failed' });
    }
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

function updateMessage(set: Setter, conversationId: string, messageId: string, patch: Partial<Message>) {
  set((s) => ({
    messages: {
      ...s.messages,
      [conversationId]: (s.messages[conversationId] || []).map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
    },
  }));
}

const previewOf = (e: WsEvent) => {
  if (e.text) return e.text;
  if (e.mediaType === 'image') return 'Photo';
  if (e.mediaType === 'video') return 'Video';
  if (e.mediaType === 'audio') return 'Voice message';
  if (e.mediaType === 'file') return e.mediaFilename || 'File';
  return '';
};

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
socket.onStatus((connected) => {
  useChat.setState({ connected });
  if (connected) {
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
      const message: Message = {
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
      };
      set((s) => {
        const list = (s.messages[e.roomId] || []).filter((m) => m.id !== message.id && (!e.clientId || m.id !== e.clientId));
        const active = s.activeId === e.roomId;
        return {
          messages: s.messages[e.roomId] || active ? { ...s.messages, [e.roomId]: [...list, message].sort(byTime) } : s.messages,
          conversations: s.conversations.map((c) =>
            c.id === e.roomId
              ? {
                  ...c,
                  lastMessage: previewOf(e),
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
      if (e.roomId && e.clientId) updateMessage(set, e.roomId, e.clientId, { status: 'failed' });
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
        updateMessage(set, e.roomId, e.messageId, {
          ...(e.text !== undefined ? { text: e.text } : {}),
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
    case 'conversation_created':
    case 'conversation_updated':
    case 'conversation_removed':
      state.loadConversations().catch(() => undefined);
      break;
  }
  extras.forEach((listener) => listener(e));
});

/** Names of people typing in a chat right now. */
export const typingNames = (typing: ChatState['typing'], conversationId: string) =>
  Object.values(typing[conversationId] || {})
    .filter((t) => t.until > Date.now())
    .map((t) => t.name || 'Someone');
