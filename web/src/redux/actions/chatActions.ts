// src/redux/actions/chatActions.ts

import { AppDispatch } from '../store';
import { chatService } from '../../services/chat.service';
import {
  setConversations,
  setMessages,
  setLoading,
  setMessagesLoading,
  setError,
  addConversation,
} from '../slices/chatSlice';

/**
 * Fetch all conversations
 */
export const fetchConversations = () => async (dispatch: AppDispatch) => {
  try {
    dispatch(setLoading(true));

    const response = await chatService.getConversations();

    if (response.success && response.data) {
      // Transform backend data to frontend format
      const conversations = response.data.map((conv: any) => ({
        id: conv.id,
        name: conv.title || conv.other_user?.username || 'Unknown',
        avatar: conv.avatar_url || conv.other_user?.avatar,
        lastMessage: conv.last_message?.text || '',
        lastMessageTime: conv.last_message?.created_at || conv.updated_at,
        unreadCount: conv.unread_count || 0,
        isOnline: conv.other_user?.is_online || false,
        isTyping: false,
        isPinned: false,
        isGroup: conv.kind === 'group',
        members: conv.members?.map((m: any) => m.user_id) || [],
      }));

      dispatch(setConversations(conversations));
    }
  } catch (error: any) {
    console.error('Failed to fetch conversations:', error);
    dispatch(setError(error.message || 'Failed to load conversations'));
  } finally {
    dispatch(setLoading(false));
  }
};

/**
 * Fetch messages for a conversation
 */
export const fetchMessages = (conversationId: string) => async (dispatch: AppDispatch) => {
  try {
    dispatch(setMessagesLoading(true));

    const response = await chatService.getMessages(conversationId);

    if (response.success && response.data) {
      // Transform backend data to frontend format
      const messages = response.data.map((msg: any) => ({
        id: msg.id,
        conversationId: msg.conversation_id,
        senderId: msg.sender_id,
        senderName: msg.sender?.username,
        senderAvatar: msg.sender?.avatar,
        text: msg.text,
        timestamp: msg.created_at,
        status: msg.status || 'delivered',
        mediaUrl: msg.media_url,
        mediaType: msg.media_type,
      }));

      dispatch(setMessages({ conversationId, messages }));
    }
  } catch (error: any) {
    console.error('Failed to fetch messages:', error);
    dispatch(setError(error.message || 'Failed to load messages'));
  } finally {
    dispatch(setMessagesLoading(false));
  }
};

/**
 * Create a new direct conversation
 */
export const createDirectConversation = (userId: string) => async (dispatch: AppDispatch) => {
  try {
    const response = await chatService.createDirectConversation(userId);

    if (response.success && response.data) {
      const conv = response.data;
      const conversation = {
        id: conv.id,
        name: conv.other_user?.username || 'Unknown',
        avatar: conv.other_user?.avatar,
        lastMessage: '',
        lastMessageTime: conv.created_at,
        unreadCount: 0,
        isOnline: conv.other_user?.is_online || false,
        isTyping: false,
        isPinned: false,
        isGroup: false,
        members: [userId],
      };

      dispatch(addConversation(conversation));
      return { success: true, conversationId: conv.id };
    }

    return { success: false };
  } catch (error: any) {
    console.error('Failed to create conversation:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create a new group conversation
 */
export const createGroupConversation = (name: string, memberIds: string[]) => async (dispatch: AppDispatch) => {
  try {
    const response = await chatService.createGroupConversation(name, memberIds);

    if (response.success && response.data) {
      const conv = response.data;
      const conversation = {
        id: conv.id,
        name: conv.title || name,
        avatar: conv.avatar_url,
        lastMessage: '',
        lastMessageTime: conv.created_at,
        unreadCount: 0,
        isOnline: false,
        isTyping: false,
        isPinned: false,
        isGroup: true,
        members: memberIds,
      };

      dispatch(addConversation(conversation));
      return { success: true, conversationId: conv.id };
    }

    return { success: false };
  } catch (error: any) {
    console.error('Failed to create group:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch available users for creating conversations
 */
export const fetchUsers = async (search?: string) => {
  try {
    const response = await chatService.getUsers(search);

    if (response.success && response.data) {
      return response.data.map((user: any) => ({
        id: user.id,
        username: user.username,
        name: user.name || user.username,
        email: user.email,
        avatar: user.avatar,
      }));
    }

    return [];
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return [];
  }
};