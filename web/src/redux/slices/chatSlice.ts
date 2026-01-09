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
    
    removeConversation: (state, action: PayloadAction<string>) => {
      state.conversations = state.conversations.filter(c => c.id !== action.payload);
    },

    // Messages
    setMessages: (state, action: PayloadAction<{ conversationId: string; messages: Message[] }>) => {
      state.messages[action.payload.conversationId] = action.payload.messages;
    },
    
    addMessage: (state, action: PayloadAction<{ conversationId: string; message: Message }>) => {
      const { conversationId, message } = action.payload;
      
      // Initialize messages array if doesn't exist
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }

      // Check if message already exists (prevent duplicates)
      const existingIndex = state.messages[conversationId].findIndex(m => m.id === message.id);
      
      if (existingIndex !== -1) {
        // Update existing message (for status updates)
        state.messages[conversationId][existingIndex] = {
          ...state.messages[conversationId][existingIndex],
          ...message
        };
      } else {
        // Add new message
        state.messages[conversationId].push(message);
      }
      
      // Update conversation last message
      const conv = state.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.lastMessage = message.text;
        conv.lastMessageTime = message.timestamp;
        
        // Increment unread count if not active conversation and not sent by current user
        if (conversationId !== state.activeConversationId) {
          conv.unreadCount = (conv.unreadCount || 0) + 1;
        }
      }

      // Move conversation to top
      const convIndex = state.conversations.findIndex(c => c.id === conversationId);
      if (convIndex > 0) {
        const [conv] = state.conversations.splice(convIndex, 1);
        state.conversations.unshift(conv);
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

    // Unread count
    incrementUnreadCount: (state, action: PayloadAction<string>) => {
      const conv = state.conversations.find(c => c.id === action.payload);
      if (conv && conv.id !== state.activeConversationId) {
        conv.unreadCount = (conv.unreadCount || 0) + 1;
      }
    },

    clearUnreadCount: (state, action: PayloadAction<string>) => {
      const conv = state.conversations.find(c => c.id === action.payload);
      if (conv) {
        conv.unreadCount = 0;
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
  setMessages,
  addMessage,
  updateMessage,
  replaceMessageId,
  setActiveConversation,
  incrementUnreadCount,
  clearUnreadCount,
  setLoading,
  setMessagesLoading,
  setError
} = chatSlice.actions;

export default chatSlice.reducer;