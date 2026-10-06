// src/redux/actions/websocketActions.ts - NO AUTH DEPENDENCY

import type { AppDispatch, RootState } from '../store';
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
  setPinned,
  markMessagesRead,
  syncOnlineStatus,
  setActiveConversation,
  updateUserOnlineStatus,
  updateConversationLastMessage,
  incrementUnreadCount,
} from '../slices/chatSlice';
import type { ReplyPreview } from '../slices/chatSlice';
import { toast } from 'react-toastify';
import { mediaService } from '../../services/media.service';
import type { OutgoingMedia } from '../../services/websocket.service';
import { captureVideoPoster, measureMedia, mediaTypeOf, messagePreview } from '../../utils/media';
import { parseApiError } from '../../utils/apiError';

import { fetchConversations, fetchMessages } from './chatActions';
import { NAVIGATE_EVENT, CONVERSATION_UPDATED_EVENT, EXPENSE_CHANGED_EVENT, RECEIPT_READY_EVENT } from '../../utils/events';
import { notifyNewMessage } from '../../utils/notifications';

// import { clearUnreadCount } from '../slices/chatSlice';

let listenersInitialized = false;

export { NAVIGATE_EVENT, CONVERSATION_UPDATED_EVENT };

// clientId -> object URL of a local attachment preview, revoked once the server echoes the message
const pendingPreviews = new Map<string, string>();

// Clients repeat "typing" every few seconds while typing; if that stops (closed tab,
// lost connection) the indicator clears itself.
const TYPING_TIMEOUT_MS = 6000;
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

function setTypingWithExpiry(
  dispatch: AppDispatch,
  conversationId: string,
  userId: string,
  isTyping: boolean,
  userName?: string | null
) {
  const key = `${conversationId}:${userId}`;
  clearTimeout(typingTimers.get(key));
  typingTimers.delete(key);
  dispatch(setTyping({ conversationId, userId, isTyping, userName }));
  if (isTyping) {
    typingTimers.set(key, setTimeout(() => {
      typingTimers.delete(key);
      dispatch(setTyping({ conversationId, userId, isTyping: false }));
    }, TYPING_TIMEOUT_MS));
  }
}

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
    // Size (to reserve space in the bubble) and, for videos, a poster frame; both best-effort
    const dimensionsPromise = measureMedia(file).then(dims => {
      if (dims) {
        dispatch(updateMessage({
          conversationId,
          messageId: clientId,
          updates: { mediaWidth: dims.width, mediaHeight: dims.height },
        }));
      }
      return dims;
    });
    const posterPromise = mediaTypeOf(file) === 'video'
      ? captureVideoPoster(file)
          .then(poster => (poster ? mediaService.upload(poster) : null))
          .catch(() => null)
      : Promise.resolve(null);

    try {
      const uploaded = await mediaService.upload(file, (percent) => {
        dispatch(updateMessage({ conversationId, messageId: clientId, updates: { uploadProgress: percent } }));
      });
      const [dims, poster] = await Promise.all([dimensionsPromise, posterPromise]);
      media = {
        mediaUrl: uploaded.url,
        mediaType: uploaded.mediaType,
        mediaSize: uploaded.size,
        mediaFilename: uploaded.filename,
        mediaThumbnail: poster?.url,
        mediaWidth: dims?.width,
        mediaHeight: dims?.height,
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


  // getStateRef = getState;

  if (listenersInitialized) {
    return;
  }

  listenersInitialized = true;  // ✅ Mark as initialized

  // Message received (also the echo of our own messages)
  wsService.on('message', async (data) => {

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
        mediaThumbnail: data.mediaThumbnail || undefined,
        mediaWidth: data.mediaWidth || undefined,
        mediaHeight: data.mediaHeight || undefined,
        uploadProgress: undefined,
        messageType: data.messageType,
        expenseId: data.expenseId || null,
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

      const roomId = data.roomId;
      const isOwn = data.senderId === localStorage.getItem('userId');

      // Sending a message means they stopped typing
      if (data.senderId) setTypingWithExpiry(dispatch, roomId, data.senderId, false);

      // Desktop notification for messages from others (skipped if this chat is in view)
      if (!isOwn && data.messageType !== 'system') {
        dispatch((_: AppDispatch, getState: () => RootState) => {
          const conversation = getState().chat.conversations.find(c => c.id === roomId);
          const sender = data.senderName || 'Someone';
          const preview = messagePreview(data.text, data.mediaType, data.mediaFilename);
          notifyNewMessage({
            conversationId: roomId,
            title: conversation?.name || sender,
            body: conversation?.isGroup ? `${sender}: ${preview}` : preview,
            icon: conversation?.isGroup ? conversation.avatar : data.senderAvatar,
          });
        });
      }

      // Keep the chat list in sync locally (last message was updated above);
      // only reload it when the message is for a conversation we don't know yet
      dispatch((_: AppDispatch, getState: () => RootState) => {
        const known = getState().chat.conversations.some(c => c.id === roomId);
        if (!known) {
          dispatch(fetchConversations());
          return;
        }
        const viewing =
          (window as any).__activeConversationId === roomId && document.visibilityState === 'visible';
        if (!isOwn && !viewing) {
          dispatch(incrementUnreadCount(roomId));
        }
      });
    }
  });

  // Typing indicator
  wsService.on('typing', (data) => {
    if (data.roomId && data.userId) {
      setTypingWithExpiry(dispatch, data.roomId, data.userId, !!data.isTyping, data.userName);
    }
  });

  wsService.on('conversation_pinned', (data) => {
    if (data.conversationId) {
      dispatch(setPinned({ conversationId: data.conversationId, pinnedAt: data.pinned ? data.pinnedAt || new Date().toISOString() : null }));
    }
  });

  // Read receipt
  wsService.on('read', (data) => {

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


    if (data.userId) {
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

  // An expense, payment or expense setting changed in one of our chats
  wsService.on('expense_changed', (data) => {
    window.dispatchEvent(new CustomEvent(EXPENSE_CHANGED_EVENT, {
      detail: { conversationId: data.conversationId, expenseId: data.expenseId, action: data.action },
    }));
  });

  // The AI finished reading a receipt we uploaded
  wsService.on('receipt_scan_ready', (data) => {
    window.dispatchEvent(new CustomEvent(RECEIPT_READY_EVENT, { detail: data }));
    // Already looking at it (the scan screen is open)? Then no toast.
    if ((window as any).__waitingForReceiptId === data.receiptId) return;
    const path = `/chat/${data.conversationId}?receipt=${data.receiptId}`;
    const open = () => window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: path }));
    if (data.status === 'failed') {
      toast.error(`Couldn't read your receipt: ${data.error || 'try again'}`, { onClick: open });
    } else {
      toast.success('Your receipt is ready to review', { onClick: open });
    }
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


    if (data.userId) {
      dispatch(removeOnlineUser(data.userId));
      dispatch(updateUserOnlineStatus({ userId: data.userId, isOnline: false }));
    }
  });

  // Joined conversation
  wsService.on('joined', (data) => {
  });

  // Left conversation
  wsService.on('left', (data) => {
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
  // Messages, reads and group changes sent while we were offline aren't replayed
  // over the socket, so reload them from the API after a reconnect.
  let missedEvents = false;

  wsService.on('connected', () => {
    dispatch(setConnected(true));

    if (missedEvents) {
      missedEvents = false;
      dispatch(fetchConversations());
      const activeId = (window as any).__activeConversationId;
      if (activeId) dispatch(fetchMessages(activeId));
    }
  });

  wsService.on('disconnected', () => {
    missedEvents = true;
    dispatch(setConnected(false));
  });
}