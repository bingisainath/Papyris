// src/redux/actions/websocketActions.ts - NO AUTH DEPENDENCY

import { AppDispatch } from '../store';
import { wsService } from '../../services/websocket.service';
import {
  setConnecting,
  setConnected,
  setError,
  addOnlineUser,
  removeOnlineUser,
  setTyping,
  resetWebSocket
} from '../slices/websocketSlice';
import {
  addMessage,
  updateMessage,
  setActiveConversation,
} from '../slices/chatSlice';

/**
 * Connect to WebSocket server
 */
export const connectWebSocket = (token: string) => async (dispatch: AppDispatch) => {
  try {
    dispatch(setConnecting(true));
    
    // Connect to WebSocket
    await wsService.connect(token);
    
    dispatch(setConnected(true));
    console.log('✅ WebSocket connected and Redux updated');

    // Setup event listeners
    setupWebSocketListeners(dispatch);

  } catch (error) {
    console.error('❌ WebSocket connection failed:', error);
    dispatch(setError(error instanceof Error ? error.message : 'Connection failed'));
    dispatch(setConnected(false));
  }
};

/**
 * Disconnect from WebSocket server
 */
export const disconnectWebSocket = () => (dispatch: AppDispatch) => {
  wsService.disconnect();
  dispatch(resetWebSocket());
  console.log('👋 WebSocket disconnected');
};

/**
 * Join a conversation
 */
export const joinConversation = (conversationId: string) => (dispatch: AppDispatch) => {
  if (!wsService.isConnected()) {
    console.warn('⚠️ WebSocket not connected, cannot join conversation');
    return;
  }

  wsService.joinConversation(conversationId);
  dispatch(setActiveConversation(conversationId));
};

/**
 * Leave a conversation
 */
export const leaveConversation = (conversationId: string) => (dispatch: AppDispatch) => {
  if (!wsService.isConnected()) {
    return;
  }

  wsService.leaveConversation(conversationId);
};

/**
 * Send a message
 * 
 * @param conversationId - The conversation ID
 * @param text - Message text
 * @param currentUserId - Current user's ID (get from localStorage or props)
 */
export const sendMessage = (
  conversationId: string, 
  text: string, 
  currentUserId: string
) => (dispatch: AppDispatch) => {
  if (!wsService.isConnected()) {
    console.error('❌ Cannot send message: WebSocket not connected');
    return;
  }

  // Get user info from localStorage or use defaults
  const username = localStorage.getItem('username') || 'User';
  const avatar = localStorage.getItem('userAvatar') || undefined;

  // Add optimistic message to UI
  const optimisticMessage = {
    id: `temp-${Date.now()}`,
    conversationId,
    senderId: currentUserId,
    senderName: username,
    senderAvatar: avatar,
    text,
    timestamp: new Date().toISOString(),
    status: 'sending' as const
  };

  dispatch(addMessage({
    conversationId,
    message: optimisticMessage
  }));

  // Send via WebSocket
  wsService.sendMessage(conversationId, text);
};

/**
 * Send typing indicator
 */
export const sendTyping = (conversationId: string, isTyping: boolean) => () => {
  if (!wsService.isConnected()) {
    return;
  }

  wsService.sendTyping(conversationId, isTyping);
};

/**
 * Mark message as read
 */
export const markAsRead = (conversationId: string, lastMessageId: string) => () => {
  if (!wsService.isConnected()) {
    return;
  }

  wsService.markAsRead(conversationId, lastMessageId);
};

/**
 * Setup WebSocket event listeners
 */
function setupWebSocketListeners(dispatch: AppDispatch) {
  // Message received
  wsService.on('message', (data) => {
    console.log('📨 New message:', data);
    
    if (data.roomId && data.messageId) {
      const message = {
        id: data.messageId,
        conversationId: data.roomId,
        senderId: data.senderId || '',
        senderName: data.senderName,
        senderAvatar: data.senderAvatar,
        text: data.text || '',
        timestamp: data.timestamp || new Date().toISOString(),
        status: data.status || 'delivered' as const,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType as 'image' | 'video' | 'file' | undefined
      };

      // Add or update message
      dispatch(addMessage({
        conversationId: data.roomId,
        message
      }));
    }
  });

  // Typing indicator
  wsService.on('typing', (data) => {
    if (data.roomId && data.userId) {
      dispatch(setTyping({
        conversationId: data.roomId,
        userId: data.userId,
        isTyping: data.isTyping || false
      }));
    }
  });

  // Read receipt
  wsService.on('read', (data) => {
    console.log('✅ Message read:', data);
    
    if (data.roomId && data.lastMessageId) {
      dispatch(updateMessage({
        conversationId: data.roomId,
        messageId: data.lastMessageId,
        updates: { status: 'read' }
      }));
    }
  });

  // User came online
  wsService.on('online', (data) => {
    if (data.userId) {
      console.log('🟢 User online:', data.userId);
      dispatch(addOnlineUser(data.userId));
    }
  });

  // User went offline
  wsService.on('offline', (data) => {
    if (data.userId) {
      console.log('🔴 User offline:', data.userId);
      dispatch(removeOnlineUser(data.userId));
    }
  });

  // Joined conversation
  wsService.on('joined', (data) => {
    console.log('✅ Joined conversation:', data.roomId);
  });

  // Left conversation
  wsService.on('left', (data) => {
    console.log('👋 Left conversation:', data.roomId);
  });

  // Error
  wsService.on('error', (data) => {
    console.error('❌ WebSocket error:', data.message);
    dispatch(setError(data.message || 'WebSocket error'));
  });

  // Connection events
  wsService.on('connected', () => {
    console.log('✅ WebSocket connected event');
    dispatch(setConnected(true));
  });

  wsService.on('disconnected', () => {
    console.log('🔌 WebSocket disconnected event');
    dispatch(setConnected(false));
  });
}