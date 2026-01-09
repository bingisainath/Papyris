// src/redux/slices/chatSlice.ts - EXAMPLE STRUCTURE
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Message {
  id: string;
  text: string;
  timestamp: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
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
}

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, Message[]>; // conversationId -> messages[]
  activeConversationId?: string;
  isLoading: boolean;
  messagesLoading: boolean;
  error?: string;
  typingUsers: Record<string, string[]>; // conversationId -> userIds[]
}

const initialState: ChatState = {
  conversations: [],
  messages: {},
  activeConversationId: undefined,
  isLoading: false,
  messagesLoading: false,
  error: undefined,
  typingUsers: {}
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
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      state.messages[conversationId].push(message);
      
      // Update conversation last message
      const conv = state.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.lastMessage = message.text;
        conv.lastMessageTime = message.timestamp;
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

    // Typing indicators
    setTyping: (state, action: PayloadAction<{ conversationId: string; userId: string; isTyping: boolean }>) => {
      const { conversationId, userId, isTyping } = action.payload;
      
      if (!state.typingUsers[conversationId]) {
        state.typingUsers[conversationId] = [];
      }
      
      if (isTyping) {
        if (!state.typingUsers[conversationId].includes(userId)) {
          state.typingUsers[conversationId].push(userId);
        }
      } else {
        state.typingUsers[conversationId] = state.typingUsers[conversationId].filter(id => id !== userId);
      }
      
      // Update conversation typing status
      const conv = state.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.isTyping = state.typingUsers[conversationId].length > 0;
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
      if (conv) {
        conv.unreadCount = (conv.unreadCount || 0) + 1;
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
  setTyping,
  setActiveConversation,
  incrementUnreadCount,
  setLoading,
  setMessagesLoading,
  setError
} = chatSlice.actions;

export default chatSlice.reducer;