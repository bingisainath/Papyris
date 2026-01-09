// src/hooks/useWebSocket.ts - NO AUTH DEPENDENCY

import { useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  connectWebSocket,
  disconnectWebSocket,
  joinConversation,
  leaveConversation,
  sendMessage as sendMessageAction,
  sendTyping as sendTypingAction,
  markAsRead as markAsReadAction
} from '../redux/actions/websocketActions';
import {
  selectIsConnected,
  selectIsConnecting,
  selectWebSocketError,
  selectOnlineUsers,
  selectTypingUsers
} from '../redux/slices/websocketSlice';
import type { AppDispatch, RootState } from '../redux/store';

/**
 * Main WebSocket hook - connects automatically on mount
 * 
 * Usage:
 * const { isConnected, reconnect } = useWebSocket(token);
 */
export const useWebSocket = (token?: string) => {
  const dispatch = useDispatch<AppDispatch>();
  const isConnected = useSelector(selectIsConnected);
  const isConnecting = useSelector(selectIsConnecting);
  const error = useSelector(selectWebSocketError);

  useEffect(() => {
    // Connect when token is provided
    if (token && !isConnected && !isConnecting) {
      console.log('🔌 Auto-connecting WebSocket...');
      dispatch(connectWebSocket(token));
    }

    // Disconnect on unmount
    return () => {
      if (isConnected) {
        console.log('🔌 Auto-disconnecting WebSocket on unmount...');
        dispatch(disconnectWebSocket());
      }
    };
  }, [token, isConnected, isConnecting, dispatch]);

  const reconnect = useCallback(() => {
    if (token) {
      dispatch(connectWebSocket(token));
    }
  }, [token, dispatch]);

  return {
    isConnected,
    isConnecting,
    error,
    reconnect
  };
};

/**
 * Hook for managing conversation rooms
 */
export const useConversationRoom = (conversationId: string | undefined) => {
  const dispatch = useDispatch<AppDispatch>();
  const isConnected = useSelector(selectIsConnected);
  const previousConversationId = useRef<string>();

  useEffect(() => {
    if (!conversationId || !isConnected) {
      return;
    }

    // Leave previous conversation
    if (previousConversationId.current && previousConversationId.current !== conversationId) {
      console.log(`📤 Leaving previous conversation: ${previousConversationId.current}`);
      dispatch(leaveConversation(previousConversationId.current));
    }

    // Join new conversation
    console.log(`📥 Joining conversation: ${conversationId}`);
    dispatch(joinConversation(conversationId));
    previousConversationId.current = conversationId;

    // Cleanup: leave conversation on unmount
    return () => {
      if (conversationId && isConnected) {
        console.log(`📤 Leaving conversation on unmount: ${conversationId}`);
        dispatch(leaveConversation(conversationId));
      }
    };
  }, [conversationId, isConnected, dispatch]);
};

/**
 * Hook for sending messages
 */
export const useSendMessage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isConnected = useSelector(selectIsConnected);
  
  // Get current user ID from localStorage or wherever you store it
  const currentUserId = localStorage.getItem('userId') || 'unknown';

  const sendMessage = useCallback((conversationId: string, text: string) => {
    if (!isConnected) {
      console.error('❌ Cannot send message: WebSocket not connected');
      return;
    }

    dispatch(sendMessageAction(conversationId, text, currentUserId));
  }, [isConnected, currentUserId, dispatch]);

  return { sendMessage, isConnected };
};

/**
 * Hook for typing indicators
 */
export const useTypingIndicator = (conversationId: string | undefined) => {
  const dispatch = useDispatch<AppDispatch>();
  const isConnected = useSelector(selectIsConnected);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const currentUserId = localStorage.getItem('userId') || 'unknown';

  // Get who's typing (excluding current user)
  const typingUserIds = useSelector(
    conversationId ? selectTypingUsers(conversationId) : () => []
  );
  const typingUsers = typingUserIds.filter(id => id !== currentUserId);

  const startTyping = useCallback(() => {
    if (!conversationId || !isConnected) return;

    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing indicator
    dispatch(sendTypingAction(conversationId, true));

    // Auto-stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      dispatch(sendTypingAction(conversationId, false));
    }, 3000);
  }, [conversationId, isConnected, dispatch]);

  const stopTyping = useCallback(() => {
    if (!conversationId || !isConnected) return;

    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send stop typing
    dispatch(sendTypingAction(conversationId, false));
  }, [conversationId, isConnected, dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    typingUsers,
    isTyping: typingUsers.length > 0,
    startTyping,
    stopTyping
  };
};

/**
 * Hook for read receipts
 */
export const useReadReceipt = (conversationId: string | undefined) => {
  const dispatch = useDispatch<AppDispatch>();
  const isConnected = useSelector(selectIsConnected);

  const markAsRead = useCallback((lastMessageId: string) => {
    if (!conversationId || !isConnected || !lastMessageId) return;

    dispatch(markAsReadAction(conversationId, lastMessageId));
  }, [conversationId, isConnected, dispatch]);

  return { markAsRead };
};

/**
 * Hook for online presence
 */
export const useOnlinePresence = (userIds: string[]) => {
  const onlineUsers = useSelector(selectOnlineUsers);

  const isOnline = useCallback((userId: string) => {
    return onlineUsers.includes(userId);
  }, [onlineUsers]);

  const onlineCount = userIds.filter(isOnline).length;

  return {
    isOnline,
    onlineUsers,
    onlineCount
  };
};