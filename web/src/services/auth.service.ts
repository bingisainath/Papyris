// src/services/auth.service.ts

import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: string;
      username: string;
      email: string;
      avatar?: string;
      name?: string;
      bio?: string;
      created_at?: string;
    };
    access_token: string;
    refresh_token?: string;
    token_type: string;
  };
}

class AuthService {
  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await axios.post(`${API_URL}/auth/login`, credentials);
    return response.data;
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await axios.post(`${API_URL}/auth/register`, data);
    return response.data;
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(token: string): Promise<any> {
    const response = await axios.get(`${API_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  }

  /**
   * Update user profile
   */
  async updateProfile(token: string, data: Partial<any>): Promise<any> {
    const response = await axios.put(`${API_URL}/users/me`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  }

  /**
   * Refresh token
   */
  async refreshToken(refreshToken: string): Promise<any> {
    const response = await axios.post(`${API_URL}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    return response.data;
  }
}

export const authService = new AuthService();