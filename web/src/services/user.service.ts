
// src/services/user.service.ts

import axios from 'axios';
import { tokenStore } from '../utils/token';
import type { User, BlockedUser, UpdateProfileData } from '../types/user.types';
import { ApiResponse } from '../types/api.types';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

const getAuthHeader = () => {
  const token = tokenStore.get();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

class UserService {
  /**
   * Search users by username or email
   * Backend endpoint: GET /api/v1/users?search=query
   */
  async searchUsers(query: string) {
    const response = await axios.get(`${API_URL}/api/v1/users`, {
      params: { search: query },  // ✅ CHANGED: 'search' not 'q'
      headers: getAuthHeader(),
    });
    return response.data;
  }

  /**
   * Get all users
   */
  async getAllUsers() {
    const response = await axios.get(`${API_URL}/api/v1/users`, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    const response = await axios.get(`${API_URL}/api/v1/users/me`, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string, token: string): Promise<ApiResponse<User>> {
    const response = await axios.get(`${API_URL}/users/${userId}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  /**
   * Update current user profile
   */
  async updateProfile(data: UpdateProfileData, token: string): Promise<ApiResponse<User>> {
    const response = await axios.put(`${API_URL}/users/me`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  /**
   * Block a user
   */
  async blockUser(userId: string, token: string): Promise<ApiResponse> {
    const response = await axios.post(`${API_URL}/users/block/${userId}`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  /**
   * Unblock a user
   */
  async unblockUser(userId: string, token: string): Promise<ApiResponse> {
    const response = await axios.delete(`${API_URL}/users/unblock/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  /**
   * Get list of blocked users
   */
  async getBlockedUsers(token: string): Promise<ApiResponse<{ blocked_users: BlockedUser[] }>> {
    const response = await axios.get(`${API_URL}/users/blocked`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  /**
   * Check if a user is blocked
   */
  async isUserBlocked(userId: string, token: string): Promise<ApiResponse<{ is_blocked: boolean }>> {
    const response = await axios.get(`${API_URL}/users/is-blocked/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  /**
   * Search users
   */
  // async searchUsers(query: string, token: string): Promise<ApiResponse<User[]>> {
  //   const response = await axios.get(`${API_URL}/users?search=${encodeURIComponent(query)}`, {
  //     headers: { Authorization: `Bearer ${token}` },
  //   });
  //   return response.data;
  // }

}

export const userService = new UserService();