// src/services/chat.service.ts

import axios from 'axios';
import { tokenStore } from '../utils/token';
import { ApiResponse } from '@/types/api.types';
import { UpdateGroupSettingsData } from '@/types/group.types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

// Get auth token from localStorage
const getAuthHeader = () => {
  // const token = localStorage.getItem('token');
  const token = tokenStore.get();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

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
  async getMessages(conversationId: string, limit = 50, offset = 0) {
    const response = await axios.get(
      `${API_URL}/conversations/${conversationId}/messages`,
      {
        params: { limit, offset },
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
  async createGroupConversation(name: string, memberIds: string[]) {
    const response = await axios.post(
      `${API_URL}/conversations`,
      {
        kind: 'group',
        title: name,
        participant_ids: memberIds,
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
  async updateGroup(conversationId: string, data: { title?: string; avatar_url?: string }) {
    const response = await axios.put(
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

  // ============================================
  // NEW: READ RECEIPTS
  // ============================================

  /**
   * Mark a single message as read
   */
  async markMessageRead(messageId: string, token: string): Promise<ApiResponse> {
    const response = await axios.post(
      `${API_URL}/messages/${messageId}/read`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  }

  /**
   * Get read receipts for a message
   */
  async getMessageReceipts(messageId: string, token: string): Promise<ApiResponse> {
    const response = await axios.get(`${API_URL}/messages/${messageId}/receipts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  // ============================================
  // NEW: GROUP MANAGEMENT
  // ============================================

  /**
   * Get complete group details
   */
  async getGroupDetails(groupId: string, token: string): Promise<ApiResponse<GroupDetails>> {
    const response = await axios.get(`${API_URL}/groups/${groupId}/details`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  /**
   * Update group settings (admin only)
   */
  async updateGroupSettings(
    groupId: string,
    settings: UpdateGroupSettingsData,
    token: string
  ): Promise<ApiResponse> {
    const response = await axios.put(`${API_URL}/groups/${groupId}/settings`, settings, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  /**
   * Make a member admin
   */
  async makeAdmin(groupId: string, userId: string, token: string): Promise<ApiResponse> {
    const response = await axios.post(
      `${API_URL}/groups/${groupId}/members/${userId}/make-admin`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  }

  /**
   * Remove admin role from a member
   */
  async removeAdmin(groupId: string, userId: string, token: string): Promise<ApiResponse> {
    const response = await axios.delete(
      `${API_URL}/groups/${groupId}/members/${userId}/remove-admin`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  }

  /**
   * Remove a member from group
   */
  async removeMember(groupId: string, userId: string, token: string): Promise<ApiResponse> {
    const response = await axios.delete(`${API_URL}/groups/${groupId}/members/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  /**
   * Leave a group
   */
  async leaveGroup(groupId: string, token: string): Promise<ApiResponse> {
    const response = await axios.post(
      `${API_URL}/groups/${groupId}/leave`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  }

}

export const chatService = new ChatService();