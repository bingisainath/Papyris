// src/services/chat.service.ts

import axios from 'axios';
import { tokenStore } from '../utils/token';
import { API_V1_URL } from '../config/env';

const API_URL = API_V1_URL;

// Get auth token from localStorage
const getAuthHeader = () => {
  // const token = localStorage.getItem('token');
  const token = tokenStore.get();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface ConversationMemberInfo {
  id: string;
  username: string;
  name?: string | null;
  avatar?: string | null;
  bio?: string | null;
  role: 'admin' | 'moderator' | 'member' | 'viewer';
  joined_at?: string | null;
  is_me: boolean;
}

export interface ConversationDetails {
  id: string;
  kind: 'dm' | 'group';
  title?: string | null;
  description?: string | null;
  avatar_url?: string | null;
  created_by?: string | null;
  created_at: string;
  my_role: ConversationMemberInfo['role'];
  members: ConversationMemberInfo[];
}

class ChatService {
  /**
   * Get all conversations for current user
   */
  async getConversations() {
    const response = await axios.get(`${API_URL}/conversations`, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string, limit = 50, before?: string) {
    const response = await axios.get(
      `${API_URL}/conversations/${conversationId}/messages`,
      {
        params: before ? { limit, before } : { limit },
        headers: getAuthHeader(),
      }
    );
    return response.data;
  }

  /**
   * Create a new direct conversation
   */
  async createDirectConversation(userId: string) {
    const response = await axios.post(
      `${API_URL}/conversations`,
      {
        kind: 'dm',
        participant_ids: [userId],
      },
      {
        headers: getAuthHeader(),
      }
    );
    return response.data;
  }

  /**
   * Create a new group conversation
   */
  async createGroupConversation(
    name: string,
    memberIds: string[],
    extra: { description?: string; avatar_url?: string } = {}
  ) {
    const response = await axios.post(
      `${API_URL}/conversations`,
      {
        kind: 'group',
        title: name,
        participant_ids: memberIds,
        ...extra,
      },
      {
        headers: getAuthHeader(),
      }
    );
    return response.data;
  }

  /**
   * Mark conversation as read on server
   */
  async markConversationRead(conversationId: string) {
    try {
      const response = await axios.post(
        `${API_URL}/conversations/${conversationId}/mark-read`,
        {},  // ✅ Empty body (axios needs this as second param)
        {
          headers: getAuthHeader(),  // ✅ Headers in third param for axios
        }
      );

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Failed to mark conversation as read:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update group conversation
   */
  async updateGroup(
    conversationId: string,
    data: { title?: string; description?: string; avatar_url?: string }
  ) {
    const response = await axios.patch(
      `${API_URL}/conversations/${conversationId}`,
      data,
      {
        headers: getAuthHeader(),
      }
    );
    return response.data;
  }

  /**
   * Add members to group
   */
  async addGroupMembers(conversationId: string, memberIds: string[]) {
    const response = await axios.post(
      `${API_URL}/conversations/${conversationId}/members`,
      { user_ids: memberIds },
      {
        headers: getAuthHeader(),
      }
    );
    return response.data;
  }

  /**
   * Remove member from group
   */
  async removeGroupMember(conversationId: string, userId: string) {
    const response = await axios.delete(
      `${API_URL}/conversations/${conversationId}/members/${userId}`,
      {
        headers: getAuthHeader(),
      }
    );
    return response.data;
  }

  /**
   * Make a group member an admin, or dismiss an admin
   */
  async updateGroupMemberRole(conversationId: string, userId: string, role: 'admin' | 'member') {
    const response = await axios.patch(
      `${API_URL}/conversations/${conversationId}/members/${userId}`,
      { role },
      { headers: getAuthHeader() }
    );
    return response.data;
  }

  /**
   * Conversation details with members (group / contact info panel)
   */
  async getConversation(conversationId: string): Promise<ConversationDetails> {
    const response = await axios.get(`${API_URL}/conversations/${conversationId}`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  }

  /**
   * Pin a conversation to the top of your list (max 3), or unpin it
   */
  async pinConversation(conversationId: string, pinned: boolean) {
    const response = await axios.put(
      `${API_URL}/conversations/${conversationId}/pin`,
      { pinned },
      { headers: getAuthHeader() }
    );
    return response.data;
  }

  /**
   * Edit the text of your own message
   */
  async editMessage(messageId: string, text: string) {
    const response = await axios.patch(
      `${API_URL}/messages/${messageId}`,
      { text },
      { headers: getAuthHeader() }
    );
    return response.data;
  }

  /**
   * Delete your own message for everyone
   */
  async deleteMessage(messageId: string) {
    const response = await axios.delete(`${API_URL}/messages/${messageId}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  /**
   * Toggle your reaction on a message (same emoji again removes it)
   */
  async reactToMessage(messageId: string, emoji: string) {
    const response = await axios.put(
      `${API_URL}/messages/${messageId}/reaction`,
      { emoji },
      { headers: getAuthHeader() }
    );
    return response.data;
  }

  /**
   * Get all users (for creating conversations)
   */
  async getUsers(search?: string) {
    const response = await axios.get(`${API_URL}/users`, {
      params: search ? { search } : {},
      headers: getAuthHeader(),
    });
    return response.data;
  }

  /**
   * Search messages
   */
  async searchMessages(query: string, conversationId?: string) {
    const response = await axios.get(`${API_URL}/messages/search`, {
      params: {
        q: query,
        conversation_id: conversationId,
      },
      headers: getAuthHeader(),
    });
    return response.data;
  }
}

export const chatService = new ChatService();