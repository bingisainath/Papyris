// src/redux/actions/websocketActions.ts - NO AUTH DEPENDENCY

import type { AppDispatch } from '../store';
import { wsService } from '../../services/websocket.service';
import {
  setConnecting,
  setConnected,
  setError,
  addOnlineUser,
  removeOnlineUser,
  setOnlineUsers,
  setTyping,
  resetWebSocket
} from '../slices/websocketSlice';
import {
  addMessage,
  updateMessage,
  upsertMessage,
  removeMessage,
  applyMessageUpdate,
  setReactions,
  markMessagesRead,
  syncOnlineStatus,
  setActiveConversation,
  updateUserOnlineStatus,
  updateConversationLastMessage,
} from '../slices/chatSlice';
import type { ReplyPreview } from '../slices/chatSlice';
import { toast } from 'react-toastify';
import { mediaService } from '../../services/media.service';
import type { OutgoingMedia } from '../../services/websocket.service';
import { mediaTypeOf, messagePreview } from '../../utils/media';
import { parseApiError } from '../../utils/apiError';

import { fetchConversations } from './chatActions';

// import { clearUnreadCount } from '../slices/chatSlice';

let listenersInitialized = false;

// Non-component code can ask the app to navigate by dispatching this window event (see Home)
export const NAVIGATE_EVENT = 'papyris:navigate';
// Fired with a conversation id when its details change (info panel refreshes)
export const CONVERSATION_UPDATED_EVENT = 'papyris:conversation-updated';

// clientId -> object URL of a local attachment preview, revoked once the server echoes the message
const pendingPreviews = new Map<string, string>();

const newClientId = () =>
  `temp-${typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

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
 * Send a message, optionally with an attachment.
 *
 * The message is shown immediately with a temporary id (its clientId). The
 * server echoes the clientId back, which is how the optimistic copy is replaced.
 * Attachments are uploaded to the Papyris server first, then sent by URL.
 */
export const sendMessage = (
  conversationId: string,
  text: string,
  currentUserId: string,
  file?: File,
  replyTo?: ReplyPreview | null
) => async (dispatch: AppDispatch) => {
  if (!wsService.isConnected()) {
    console.error('❌ Cannot send message: WebSocket not connected');
    toast.error('Not connected. Please wait a moment and try again.');
    return;
  }

  const username = localStorage.getItem('username') || 'You';
  const avatar = localStorage.getItem('userAvatar') || undefined;

  const clientId = newClientId();
  const previewUrl = file ? URL.createObjectURL(file) : undefined;

  dispatch(addMessage({
    conversationId,
    message: {
      id: clientId,
      clientId,
      conversationId,
      senderId: currentUserId,
      senderName: username,
      senderAvatar: avatar,
      text,
      timestamp: new Date().toISOString(),
      status: 'sending',
      mediaUrl: previewUrl,
      mediaType: file ? mediaTypeOf(file) : undefined,
      mediaSize: file?.size,
      mediaFilename: file?.name,
      uploadProgress: file ? 0 : undefined,
      replyTo: replyTo || null,
    }
  }));

  let media: OutgoingMedia | undefined;
  if (file) {
    try {
      const uploaded = await mediaService.upload(file, (percent) => {
        dispatch(updateMessage({ conversationId, messageId: clientId, updates: { uploadProgress: percent } }));
      });
      media = {
        mediaUrl: uploaded.url,
        mediaType: uploaded.mediaType,
        mediaSize: uploaded.size,
        mediaFilename: uploaded.filename,
      };
    } catch (error) {
      // Nothing was sent, so don't leave a bubble behind
      dispatch(removeMessage({ conversationId, messageId: clientId }));
      URL.revokeObjectURL(previewUrl!);
      toast.error(`Couldn't send ${file.name}: ${parseApiError(error)}`);
      return;
    }
    pendingPreviews.set(clientId, previewUrl!);
  }

  if (!wsService.sendMessage(conversationId, clientId, text, media, replyTo?.id)) {
    dispatch(updateMessage({ conversationId, messageId: clientId, updates: { status: 'failed' } }));
    toast.error('Message not sent: connection lost.');
  }
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

  // Message received (also the echo of our own messages)
  wsService.on('message', async (data) => {
    console.log('📨 Message event received:', data);

    if (data.roomId && data.messageId) {
      const message = {
        id: data.messageId,
        clientId: data.clientId || undefined,
        conversationId: data.roomId,
        senderId: data.senderId || '',
        senderName: data.senderName,
        senderAvatar: data.senderAvatar,
        text: data.text || '',
        timestamp: data.timestamp || new Date().toISOString(),
        status: (data.status as 'sent' | 'delivered' | undefined) || 'delivered',
        mediaUrl: data.mediaUrl || undefined,
        mediaType: data.mediaType || undefined,
        mediaSize: data.mediaSize || undefined,
        mediaFilename: data.mediaFilename || undefined,
        uploadProgress: undefined,
        messageType: data.messageType,
        replyTo: data.replyTo || null,
        reactions: [],
      };

      dispatch(upsertMessage({ conversationId: data.roomId, message }));

      // Our optimistic copy now points at the server URL; free the local preview
      if (data.clientId && pendingPreviews.has(data.clientId)) {
        URL.revokeObjectURL(pendingPreviews.get(data.clientId)!);
        pendingPreviews.delete(data.clientId);
      }

      // Update last message
      dispatch(updateConversationLastMessage({
        conversationId: data.roomId,
        lastMessage: messagePreview(data.text, data.mediaType, data.mediaFilename),
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

    // readUpTo: every member has read up to this time, so our older messages are read
    if (data.roomId && data.readUpTo) {
      dispatch(markMessagesRead({
        conversationId: data.roomId,
        readUpTo: data.readUpTo
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

  // A message was edited or deleted
  wsService.on('message_updated', (data) => {
    if (!data.roomId || !data.messageId) return;
    dispatch(applyMessageUpdate({
      conversationId: data.roomId,
      messageId: data.messageId,
      text: data.text,
      editedAt: data.editedAt,
      isDeleted: data.isDeleted,
    }));
    dispatch(fetchConversations()); // last-message preview may have changed
  });

  wsService.on('reactions_updated', (data) => {
    if (!data.roomId || !data.messageId) return;
    dispatch(setReactions({
      conversationId: data.roomId,
      messageId: data.messageId,
      reactions: data.reactions || [],
    }));
  });

  // Group renamed / photo / members changed
  wsService.on('conversation_updated', (data) => {
    dispatch(fetchConversations());
    window.dispatchEvent(new CustomEvent(CONVERSATION_UPDATED_EVENT, { detail: data.conversationId }));
  });

  // We were removed from a group (or left it on another device)
  wsService.on('conversation_removed', (data) => {
    dispatch(fetchConversations());
    if (!data.conversationId) return;

    if ((window as any).__activeConversationId === data.conversationId) {
      window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: '/chat' }));
    }
    if (!data.left) {
      toast.info(`${data.removedByName || 'An admin'} removed you from "${data.title || 'a group'}"`);
    }
  });

  // Someone created a DM or group that includes us: show it in the chat list right away
  wsService.on('conversation_created', (data) => {
    dispatch(fetchConversations());

    const isOwn = data.createdBy === localStorage.getItem('userId');
    if (!isOwn && data.kind === 'group' && data.conversationId) {
      const path = `/chat/${data.conversationId}`;
      toast.info(`${data.createdByName || 'Someone'} added you to "${data.title || 'a group'}"`, {
        onClick: () => window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: path })),
      });
    }
  });

  // Snapshot of everyone online, sent by the server when we connect
  wsService.on('presence', (data) => {
    const userIds = data.userIds || [];
    dispatch(setOnlineUsers(userIds));
    dispatch(syncOnlineStatus({ onlineUserIds: userIds, currentUserId: localStorage.getItem('userId') }));
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

    // Server rejected one of our messages
    if (data.clientId && data.roomId) {
      dispatch(updateMessage({
        conversationId: data.roomId,
        messageId: data.clientId,
        updates: { status: 'failed', uploadProgress: undefined }
      }));
      toast.error(`Message not sent: ${data.message || 'unknown error'}`);
      return;
    }

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