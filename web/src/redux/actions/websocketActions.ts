// src/redux/actions/websocketActions.ts - NO AUTH DEPENDENCY

import type { AppDispatch, RootState } from '../store';
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
  replaceOptimisticMessage,
  updateUserOnlineStatus,
  updateConversationLastMessage,
  incrementUnreadCount,
  createPlaceholderConversation
} from '../slices/chatSlice';

import { fetchConversations } from './chatActions';

// import { clearUnreadCount } from '../slices/chatSlice';

let getStateRef: (() => RootState) | null = null;
let listenersInitialized = false;

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
  } finally {
    dispatch(setConnecting(false));
  }

};

/**
 * Disconnect from WebSocket server
 */
export const disconnectWebSocket = () => (dispatch: AppDispatch) => {
  wsService.disconnect();
  dispatch(resetWebSocket());
  listenersInitialized = false;
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

  const tempId = `temp-${Date.now()}`;

  const optimisticMessage = {
    id: tempId,
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

  // Store temp ID for later replacement
  (window as any).__lastTempMessageId = tempId;

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

  console.log('🎧 Setting up WebSocket listeners');

  // getStateRef = getState;

  if (listenersInitialized) {
    console.log('⏭️ Listeners already initialized, skipping');
    return;
  }

  console.log('🎧 Setting up WebSocket listeners');
  listenersInitialized = true;  // ✅ Mark as initialized

  // Message received
  wsService.on('message', async (data) => {
    console.log('📨 Message event received:', data);

    if (data.roomId && data.messageId) {

      // dispatch(clearUnreadCount(data.roomId));

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

      // Get current user ID
      // const currentUserId = localStorage.getItem('userId');
      // const isOwnMessage = data.senderId === currentUserId;
      // const activeConversationId = (window as any).__activeConversationId;

      const tempId = (window as any).__lastTempMessageId;
      if (tempId) {
        dispatch(replaceOptimisticMessage({
          conversationId: data.roomId,
          tempId: tempId,
          message: message
        }));
        delete (window as any).__lastTempMessageId;
      } else {
        // No optimistic message, just add
        dispatch(addMessage({
          conversationId: data.roomId,
          message
        }));
      }

      // Update last message
      dispatch(updateConversationLastMessage({
        conversationId: data.roomId,
        lastMessage: data.text || '',
        timestamp: data.timestamp || new Date().toISOString()
      }));

      // console.log('Listener counts:', wsService.getListenerCount());

      // ✅ Increment unread count if not own message and not viewing this conversation
      // if (!isOwnMessage && data.roomId !== activeConversationId) {
      //   dispatch(incrementUnreadCount(data.roomId));
      //   console.log(`📬 Unread count incremented for conversation ${data.roomId}`);
      // } else if (!isOwnMessage && data.roomId === activeConversationId) {
      //   console.log('  👁️ Message in active conversation - not incrementing unread');
      // } else {
      //   console.log('  🙋 Own message - not incrementing unread');
      // }

      // ✅ Fetch conversations to get new conversations
      // (unread counts will be preserved by fetchConversations)
      console.log('  🔄 Fetching conversations (unread will be preserved)');
      setTimeout(() => {
        dispatch(fetchConversations());
      }, 100);
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
    // console.log('✅ Message read:', data);

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

    console.log('%c🟢 ONLINE EVENT', 'background: #4CAF50; color: white; padding: 2px 5px; border-radius: 3px;');
    console.log('  User ID:', data.userId);

    if (data.userId) {
      console.log('🟢 User online:', data.userId);
      dispatch(addOnlineUser(data.userId));
      dispatch(updateUserOnlineStatus({ userId: data.userId, isOnline: true }));
    }
  });

  // User went offline
  wsService.on('offline', (data) => {

    console.log('%c🔴 OFFLINE EVENT', 'background: #9E9E9E; color: white; padding: 2px 5px; border-radius: 3px;');
    console.log('  User ID:', data.userId);

    if (data.userId) {
      console.log('🔴 User offline:', data.userId);
      dispatch(removeOnlineUser(data.userId));
      dispatch(updateUserOnlineStatus({ userId: data.userId, isOnline: false }));
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
    listenersInitialized = false;
  });
}