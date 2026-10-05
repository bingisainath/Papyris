// src/redux/slices/chatSlice.ts - UPDATED WITH WEBSOCKET

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ReplyPreview {
  id: string;
  text: string;
  senderId: string;
  senderName?: string | null;
  messageType?: string;
  isDeleted?: boolean;
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  clientId?: string; // temp id of the optimistic copy this message replaces
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'file';
  mediaSize?: number;
  mediaFilename?: string;
  uploadProgress?: number; // 0-100 while an attachment is uploading
  messageType?: 'text' | 'image' | 'video' | 'file' | 'system';
  replyTo?: ReplyPreview | null;
  reactions?: Reaction[];
  isDeleted?: boolean;
  editedAt?: string | null;
}

const byTimestamp = (a: Message, b: Message) =>
  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();

interface Conversation {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  isOnline?: boolean;
  isTyping?: boolean;
  isPinned?: boolean;
  isGroup?: boolean;
  members?: string[];
}

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, Message[]>; // conversationId -> messages[]
  hasMoreMessages: Record<string, boolean>; // conversationId -> older messages exist on server
  activeConversationId?: string;
  isLoading: boolean;
  messagesLoading: boolean;
  error?: string;
}

const initialState: ChatState = {
  conversations: [],
  messages: {},
  hasMoreMessages: {},
  activeConversationId: undefined,
  isLoading: false,
  messagesLoading: false,
  error: undefined
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    // Conversations
    setConversations: (state, action: PayloadAction<Conversation[]>) => {
      state.conversations = action.payload;
    },

    addConversation: (state, action: PayloadAction<Conversation>) => {
      state.conversations.unshift(action.payload);
    },

    updateConversation: (state, action: PayloadAction<{ id: string; updates: Partial<Conversation> }>) => {
      const index = state.conversations.findIndex(c => c.id === action.payload.id);
      if (index !== -1) {
        state.conversations[index] = { ...state.conversations[index], ...action.payload.updates };
      }
    },

    updateConversationLastMessage: (
      state,
      action: PayloadAction<{
        conversationId: string;
        lastMessage: string;
        timestamp: string;
        createIfNotExists?: boolean;
      }>
    ) => {
      const { conversationId, lastMessage, timestamp, createIfNotExists } = action.payload;
      let conversation = state.conversations.find(c => c.id === conversationId);

      if (!conversation && createIfNotExists) {
        // Create placeholder
        conversation = {
          id: conversationId,
          name: 'New Conversation',
          avatar: undefined,
          lastMessage: lastMessage,
          lastMessageTime: timestamp,
          unreadCount: 1,
          isOnline: false,
          isGroup: false,
          members: [],
        };
        state.conversations.unshift(conversation);
      } else if (conversation) {
        conversation.lastMessage = lastMessage;
        conversation.lastMessageTime = timestamp;

        // Move to top
        const index = state.conversations.indexOf(conversation);
        if (index > 0) {
          state.conversations.splice(index, 1);
          state.conversations.unshift(conversation);
        }
        console.log(`✅ Updated last message for ${conversation.name}`);
      }
    },

    removeConversation: (state, action: PayloadAction<string>) => {
      state.conversations = state.conversations.filter(c => c.id !== action.payload);
    },

    updateUserOnlineStatus: (
      state,
      action: PayloadAction<{ userId: string; isOnline: boolean }>
    ) => {
      const { userId, isOnline } = action.payload;
      const currentUserId = localStorage.getItem('userId');

      let updated = 0;

      state.conversations.forEach(conv => {

        if (
          !conv.isGroup &&
          conv.members &&
          Array.isArray(conv.members) &&
          conv.members.includes(userId) &&
          userId !== currentUserId
        ) {
          const oldStatus = conv.isOnline;
          conv.isOnline = isOnline;
          updated++;

          console.log(`     ✅ UPDATED: ${oldStatus} → ${isOnline}`);
        } else {
          console.log(`     ⏭️ SKIPPED`);
        }
      });

      console.log(`  📊 Updated ${updated} conversations`);

      if (updated === 0) {
        console.log(`  ⚠️ No conversations updated!`);
        console.log(`  📋 Current conversations:`, state.conversations.map(c => ({
          name: c.name,
          members: c.members,
          isGroup: c.isGroup
        })));
      }
    },

    // Messages
    setMessages: (
      state,
      action: PayloadAction<{ conversationId: string; messages: Message[]; hasMore?: boolean }>
    ) => {
      const { conversationId, messages, hasMore } = action.payload;
      const fetchedIds = new Set(messages.map(m => m.id));
      const newestFetched = messages.length
        ? new Date(messages[messages.length - 1].timestamp).getTime()
        : 0;

      // Keep pending sends and live messages that arrived while the request was in flight
      const keep = (state.messages[conversationId] || []).filter(m =>
        !fetchedIds.has(m.id) &&
        (m.id.startsWith('temp-') || new Date(m.timestamp).getTime() > newestFetched)
      );

      state.messages[conversationId] = [...messages, ...keep].sort(byTimestamp);
      state.hasMoreMessages[conversationId] = !!hasMore;
    },

    prependMessages: (
      state,
      action: PayloadAction<{ conversationId: string; messages: Message[]; hasMore: boolean }>
    ) => {
      const { conversationId, messages, hasMore } = action.payload;
      const existing = state.messages[conversationId] || [];
      const existingIds = new Set(existing.map(m => m.id));
      state.messages[conversationId] = [
        ...messages.filter(m => !existingIds.has(m.id)),
        ...existing,
      ].sort(byTimestamp);
      state.hasMoreMessages[conversationId] = hasMore;
    },

    /**
     * Add a message from the server. If it is the echo of one of our optimistic
     * messages (same clientId), replace that copy instead of adding a new one.
     */
    upsertMessage: (state, action: PayloadAction<{ conversationId: string; message: Message }>) => {
      const { conversationId, message } = action.payload;
      const list = state.messages[conversationId] || (state.messages[conversationId] = []);

      const index = list.findIndex(m =>
        m.id === message.id || (!!message.clientId && m.id === message.clientId)
      );
      if (index !== -1) {
        list[index] = { ...list[index], ...message };
      } else {
        list.push(message);
      }
      list.sort(byTimestamp);
    },

    /** A message was edited or deleted (by its sender, possibly on another device) */
    applyMessageUpdate: (
      state,
      action: PayloadAction<{
        conversationId: string;
        messageId: string;
        text?: string;
        editedAt?: string | null;
        isDeleted?: boolean;
      }>
    ) => {
      const { conversationId, messageId, text, editedAt, isDeleted } = action.payload;
      (state.messages[conversationId] || []).forEach(m => {
        if (m.id === messageId) {
          if (isDeleted) {
            Object.assign(m, {
              isDeleted: true, text: '', mediaUrl: undefined, mediaType: undefined,
              mediaFilename: undefined, mediaSize: undefined, reactions: [], editedAt: null,
            });
          } else {
            if (text !== undefined) m.text = text;
            if (editedAt !== undefined) m.editedAt = editedAt;
          }
        }
        // Keep reply quotes of this message in sync
        if (m.replyTo?.id === messageId) {
          if (isDeleted) m.replyTo = { ...m.replyTo, isDeleted: true, text: 'This message was deleted' };
          else if (text !== undefined) m.replyTo = { ...m.replyTo, text };
        }
      });
    },

    setReactions: (
      state,
      action: PayloadAction<{ conversationId: string; messageId: string; reactions: Reaction[] }>
    ) => {
      const { conversationId, messageId, reactions } = action.payload;
      const message = (state.messages[conversationId] || []).find(m => m.id === messageId);
      if (message) message.reactions = reactions;
    },

    removeMessage: (state, action: PayloadAction<{ conversationId: string; messageId: string }>) => {
      const { conversationId, messageId } = action.payload;
      const list = state.messages[conversationId];
      if (list) {
        state.messages[conversationId] = list.filter(m => m.id !== messageId);
      }
    },

    /** Everyone in the conversation has read up to readUpTo: update sent/delivered ticks. */
    markMessagesRead: (state, action: PayloadAction<{ conversationId: string; readUpTo: string }>) => {
      const { conversationId, readUpTo } = action.payload;
      const limit = new Date(readUpTo).getTime();
      (state.messages[conversationId] || []).forEach(m => {
        if ((m.status === 'sent' || m.status === 'delivered') && new Date(m.timestamp).getTime() <= limit) {
          m.status = 'read';
        }
      });
    },

    /** Recompute DM online flags from a full list of online user ids. */
    syncOnlineStatus: (state, action: PayloadAction<{ onlineUserIds: string[]; currentUserId: string | null }>) => {
      const { onlineUserIds, currentUserId } = action.payload;
      const online = new Set(onlineUserIds);
      state.conversations.forEach(conv => {
        if (conv.isGroup || !conv.members) return;
        const otherId = conv.members.find(id => id !== currentUserId);
        conv.isOnline = !!otherId && online.has(otherId);
      });
    },

    replaceOptimisticMessage: (
      state,
      action: PayloadAction<{
        conversationId: string;
        tempId: string;
        message: Message
      }>
    ) => {
      const { conversationId, tempId, message } = action.payload;

      if (!state.messages[conversationId]) return;

      const index = state.messages[conversationId].findIndex(m => m.id === tempId);

      if (index !== -1) {
        // Replace optimistic with real
        state.messages[conversationId][index] = message;
        console.log(`✅ Replaced temp message ${tempId} with real ${message.id}`);
      } else {
        // Not found, just add it
        state.messages[conversationId].push(message);
      }

      // Sort by timestamp
      state.messages[conversationId].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    },

    addMessage: (
      state,
      action: PayloadAction<{ conversationId: string; message: Message }>
    ) => {
      const { conversationId, message } = action.payload;

      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }

      // ✅ Check if message already exists
      const exists = state.messages[conversationId].some(m => m.id === message.id);

      if (!exists) {
        state.messages[conversationId].push(message);

        // Sort by timestamp
        state.messages[conversationId].sort((a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      } else {
        console.log(`⏭️ Message ${message.id} already exists, skipping`);
      }
    },


    updateMessage: (state, action: PayloadAction<{ conversationId: string; messageId: string; updates: Partial<Message> }>) => {
      const { conversationId, messageId, updates } = action.payload;
      const messages = state.messages[conversationId];

      if (messages) {
        const index = messages.findIndex(m => m.id === messageId);
        if (index !== -1) {
          messages[index] = { ...messages[index], ...updates };
        }
      }
    },


    // Replace temp message ID with real ID from server
    replaceMessageId: (state, action: PayloadAction<{ conversationId: string; tempId: string; realId: string }>) => {
      const { conversationId, tempId, realId } = action.payload;
      const messages = state.messages[conversationId];

      if (messages) {
        const index = messages.findIndex(m => m.id === tempId);
        if (index !== -1) {
          messages[index].id = realId;
          messages[index].status = 'sent';
        }
      }
    },

    // Active conversation
    setActiveConversation: (state, action: PayloadAction<string | undefined>) => {
      state.activeConversationId = action.payload;

      // Mark as read
      if (action.payload) {
        const conv = state.conversations.find(c => c.id === action.payload);
        if (conv) {
          conv.unreadCount = 0;
        }
      }
    },

    // ✅ Create placeholder conversation for new messages
    createPlaceholderConversation: (
      state,
      action: PayloadAction<{
        conversationId: string;
        senderId: string;
        senderName?: string;
        senderAvatar?: string;
        lastMessage: string;
        timestamp: string;
      }>
    ) => {
      const { conversationId, senderId, senderName, senderAvatar, lastMessage, timestamp } = action.payload;

      // Check if already exists
      const exists = state.conversations.some(c => c.id === conversationId);
      if (exists) return;

      console.log('🆕 Creating placeholder conversation:', conversationId.substring(0, 8));

      // Create placeholder
      const placeholder: Conversation = {
        id: conversationId,
        name: senderName || 'Unknown',
        avatar: senderAvatar || undefined,
        lastMessage: lastMessage,
        lastMessageTime: timestamp,
        unreadCount: 1,  // Start with 1 unread
        isOnline: false,
        isGroup: false,
        members: [senderId],  // Will be updated when full data loads
        isPinned: false,
        isTyping: false,
      };

      // Add to top of list
      state.conversations.unshift(placeholder);

      console.log('✅ Placeholder conversation created');
    },



    // incrementUnreadCount: (state, action: PayloadAction<string>) => {
    //   const conversationId = action.payload;
    //   const conversation = state.conversations.find(c => c.id === conversationId);

    //   if (conversation) {
    //     conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    //     console.log(`📬 Unread count for ${conversation.name}: ${conversation.unreadCount}`);
    //   }
    // },

    incrementUnreadCount: (state, action: PayloadAction<string>) => {
      const conversationId = action.payload;
      const conversation = state.conversations.find(c => c.id === conversationId);

      if (conversation) {
        const oldCount = conversation.unreadCount || 0;
        conversation.unreadCount = oldCount + 1;

        console.log(`%c📬 INCREMENT UNREAD`, 'background: #4CAF50; color: white; padding: 2px 5px; border-radius: 3px;');
        console.log(`  Conversation: ${conversation.name}`);
        console.log(`  ${oldCount} → ${conversation.unreadCount}`);
        console.log(`  Called from:`);
        console.trace(); // ✅ Shows call stack
      }
    },

    // ✅ CLEAR - Track who's calling
    // clearUnreadCount: (state, action: PayloadAction<string>) => {
    //   const conversationId = action.payload;
    //   const conversation = state.conversations.find(c => c.id === conversationId);

    //   if (conversation) {
    //     const oldCount = conversation.unreadCount || 0;

    //     if (oldCount > 0) {
    //       console.log(`%c❌ CLEAR UNREAD`, 'background: #f44336; color: white; padding: 2px 5px; border-radius: 3px;');
    //       console.log(`  Conversation: ${conversation.name}`);
    //       console.log(`  ${oldCount} → 0`);
    //       console.log(`  Called from:`);
    //       console.trace(); // ✅ Shows call stack
    //     }

    //     conversation.unreadCount = 0;
    //   }
    // },

    clearUnreadCount: (state, action: PayloadAction<string>) => {
      const conversationId = action.payload;
      const conversation = state.conversations.find(c => c.id === conversationId);

      if (conversation && (conversation.unreadCount ?? 0) > 0) {
        const oldCount = conversation.unreadCount;
        conversation.unreadCount = 0;

        console.log(`%c❌ CLEAR UNREAD`, 'background: #f44336; color: white; padding: 2px 5px;');
        console.log(`  Conversation: ${conversation.name}`);
        console.log(`  ${oldCount} → 0`);
        console.trace();
      }
    },

    // Loading states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setMessagesLoading: (state, action: PayloadAction<boolean>) => {
      state.messagesLoading = action.payload;
    },

    setError: (state, action: PayloadAction<string | undefined>) => {
      state.error = action.payload;
    }
  }
});

export const {
  setConversations,
  addConversation,
  updateConversation,
  removeConversation,
  updateUserOnlineStatus,
  setMessages,
  prependMessages,
  upsertMessage,
  removeMessage,
  applyMessageUpdate,
  setReactions,
  markMessagesRead,
  syncOnlineStatus,
  replaceOptimisticMessage,
  addMessage,
  updateMessage,
  updateConversationLastMessage,
  replaceMessageId,
  setActiveConversation,
  createPlaceholderConversation,
  incrementUnreadCount,
  clearUnreadCount,
  setLoading,
  setMessagesLoading,
  setError
} = chatSlice.actions;

export default chatSlice.reducer;

// Selectors
export const selectActiveConversation = (state: { chat: ChatState }) =>
  state.chat.conversations.find(c => c.id === state.chat.activeConversationId);