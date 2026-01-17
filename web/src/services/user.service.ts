
// src/services/user.service.ts - FIXED

import axios from 'axios';
import { tokenStore } from '../utils/token';

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
}

export const userService = new UserService();