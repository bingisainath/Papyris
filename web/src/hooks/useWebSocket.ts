// src/hooks/useWebSocket.ts

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

import { wsService } from '../services/websocket.service';
import type { ReplyPreview } from '../redux/slices/chatSlice';

// Stable empty value for selectors: returning a new [] each time makes components re-render
const EMPTY: never[] = [];
const selectNoTypingUsers = () => EMPTY;

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

  const connectionInitiated = useRef(false); 
  const currentToken = useRef<string | undefined>(undefined);

  useEffect(() => {

    if (!token) return;
    
    // Connect when token is provided
    if (token && !isConnected && !isConnecting) {
      console.log('🔌 Auto-connecting WebSocket...');
      dispatch(connectWebSocket(token));
    }

    // ✅ Skip if already connecting
    if (isConnecting) {
      console.log('⏳ Connection already in progress');
      return;
    }

    // ✅ Skip if we already initiated connection for this token
    if (connectionInitiated.current && currentToken.current === token) {
      console.log('⏭️ Connection already initiated for this token');
      return;
    }

    // ✅ Connect
    console.log('🔌 Connecting WebSocket...');
    connectionInitiated.current = true;
    currentToken.current = token;
    dispatch(connectWebSocket(token));

    // Disconnect on unmount
    return () => {
      // Only disconnect if token is changing or component unmounting
      if (currentToken.current !== token) {
        console.log('🔌 Token changed, disconnecting...');
        dispatch(disconnectWebSocket());
        connectionInitiated.current = false;
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


// export const useConversationRoom = (conversationId: string | undefined) => {
//   const lastConversationId = useRef<string | undefined>();
//   const isConnected = wsService.isConnected();  // ✅ ADD: Check connection status

//   useEffect(() => {
//     // ✅ Skip if WebSocket not connected
//     if (!isConnected) {
//       console.log('⏳ Waiting for WebSocket connection before joining room');
//       return;
//     }

//     // Skip if no conversation or already joined
//     if (!conversationId || conversationId === lastConversationId.current) {
//       return;
//     }

//     // Leave previous room if different
//     if (lastConversationId.current && lastConversationId.current !== conversationId) {
//       console.log(`📤 Leaving previous conversation: ${lastConversationId.current}`);
//       try {
//         wsService.leaveConversation(lastConversationId.current);
//       } catch (error) {
//         console.error('Error leaving room:', error);
//       }
//     }

//     // Join new room
//     console.log(`📥 Joining conversation: ${conversationId}`);
//     try {
//       wsService.joinConversation(conversationId);
//       lastConversationId.current = conversationId;
//     } catch (error) {
//       console.error('Error joining room:', error);
//     }

//     // Cleanup on unmount
//     return () => {
//       if (conversationId && isConnected) {
//         console.log(`📤 Leaving conversation on unmount: ${conversationId}`);
//         try {
//           wsService.leaveConversation(conversationId);
//         } catch (error) {
//           console.error('Error leaving room on unmount:', error);
//         }
//         lastConversationId.current = undefined;
//       }
//     };
//   }, [conversationId, isConnected]);  // ✅ ADD: Depend on isConnected
// };

export const useConversationRoom = (conversationId: string | undefined) => {
  // The service remembers joined rooms and (re)joins them whenever the socket opens
  useEffect(() => {
    if (!conversationId) return;

    wsService.joinConversation(conversationId);
    return () => wsService.leaveConversation(conversationId);
  }, [conversationId]);
};


// export const useConversationRoom = (conversationId: string | undefined) => {
//   const lastConversationId = useRef<string | undefined>();
//   const hasJoined = useRef(false);

//   useEffect(() => {
//     // Skip if no conversation
//     if (!conversationId) {
//       return;
//     }

//     // Skip if already in this conversation
//     if (conversationId === lastConversationId.current && hasJoined.current) {
//       console.log(`✅ Already in conversation: ${conversationId}`);
//       return;
//     }

//     // Leave previous room if different
//     if (lastConversationId.current && lastConversationId.current !== conversationId) {
//       console.log(`📤 Leaving previous conversation: ${lastConversationId.current}`);
//       wsService.leaveConversation(lastConversationId.current);
//       hasJoined.current = false;
//     }

//     // Join new room
//     console.log(`📥 Joining conversation: ${conversationId}`);
//     wsService.joinConversation(conversationId);
//     lastConversationId.current = conversationId;
//     hasJoined.current = true;

//     // Cleanup on unmount
//     return () => {
//       if (conversationId && hasJoined.current) {
//         console.log(`📤 Leaving conversation on unmount: ${conversationId}`);
//         wsService.leaveConversation(conversationId);
//         lastConversationId.current = undefined;
//         hasJoined.current = false;
//       }
//     };
//   }, [conversationId]);
// };

/**
 * Hook for sending messages
 */
export const useSendMessage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isConnected = useSelector(selectIsConnected);

  // Get current user ID from localStorage or wherever you store it
  const currentUserId = localStorage.getItem('userId') || 'unknown';

  const sendMessage = useCallback((
    conversationId: string,
    text: string,
    file?: File,
    replyTo?: ReplyPreview | null
  ) => {
    if (!isConnected) {
      console.error('❌ Cannot send message: WebSocket not connected');
      return;
    }

    dispatch(sendMessageAction(conversationId, text, currentUserId, file, replyTo));
  }, [isConnected, currentUserId, dispatch]);

  return { sendMessage, isConnected };
};

/**
 * Hook for typing indicators
 */
export const useTypingIndicator = (conversationId: string | undefined) => {
  const dispatch = useDispatch<AppDispatch>();
  const isConnected = useSelector(selectIsConnected);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const currentUserId = localStorage.getItem('userId') || 'unknown';

  // Get who's typing (excluding current user)
  const typingUserIds = useSelector(
    conversationId ? selectTypingUsers(conversationId) : selectNoTypingUsers
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

  // console.log('===========websocket online =========');
  // console.log(isOnline);
  // console.log('====================================');

  const onlineCount = userIds.filter(isOnline).length;

  return {
    isOnline,
    onlineUsers,
    onlineCount
  };
};