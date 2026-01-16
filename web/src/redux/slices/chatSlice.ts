// src/redux/slices/chatSlice.ts - UPDATED WITH WEBSOCKET

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'file';
}

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
  activeConversationId?: string;
  isLoading: boolean;
  messagesLoading: boolean;
  error?: string;
}

const initialState: ChatState = {
  conversations: [],
  messages: {},
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
    setMessages: (state, action: PayloadAction<{ conversationId: string; messages: Message[] }>) => {
      state.messages[action.payload.conversationId] = action.payload.messages;
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
        avatar: senderAvatar || null,
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

      if (conversation && conversation.unreadCount > 0) {
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