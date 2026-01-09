// src/redux/slices/websocketSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  onlineUsers: string[];
  typingUsers: Record<string, string[]>; // conversationId -> userIds[]
}

const initialState: WebSocketState = {
  isConnected: false,
  isConnecting: false,
  error: null,
  onlineUsers: [],
  typingUsers: {}
};

const websocketSlice = createSlice({
  name: 'websocket',
  initialState,
  reducers: {
    // Connection status
    setConnecting: (state, action: PayloadAction<boolean>) => {
      state.isConnecting = action.payload;
    },
    
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
      if (action.payload) {
        state.error = null;
        state.isConnecting = false;
      }
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isConnecting = false;
    },

    // Online users
    addOnlineUser: (state, action: PayloadAction<string>) => {
      if (!state.onlineUsers.includes(action.payload)) {
        state.onlineUsers.push(action.payload);
      }
    },
    
    removeOnlineUser: (state, action: PayloadAction<string>) => {
      state.onlineUsers = state.onlineUsers.filter(id => id !== action.payload);
    },
    
    setOnlineUsers: (state, action: PayloadAction<string[]>) => {
      state.onlineUsers = action.payload;
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
    },

    // Clear all typing for a conversation
    clearTyping: (state, action: PayloadAction<string>) => {
      delete state.typingUsers[action.payload];
    },

    // Reset state on disconnect
    resetWebSocket: (state) => {
      state.isConnected = false;
      state.isConnecting = false;
      state.error = null;
      state.typingUsers = {};
      // Keep online users list for UI
    }
  }
});

export const {
  setConnecting,
  setConnected,
  setError,
  addOnlineUser,
  removeOnlineUser,
  setOnlineUsers,
  setTyping,
  clearTyping,
  resetWebSocket
} = websocketSlice.actions;

// Selectors
export const selectIsConnected = (state: RootState) => state.websocket?.isConnected || false;
export const selectIsConnecting = (state: RootState) => state.websocket?.isConnecting || false;
export const selectWebSocketError = (state: RootState) => state.websocket?.error;
export const selectOnlineUsers = (state: RootState) => state.websocket?.onlineUsers || [];
export const selectTypingUsers = (conversationId: string) => (state: RootState) => 
  state.websocket?.typingUsers[conversationId] || [];

export default websocketSlice.reducer;