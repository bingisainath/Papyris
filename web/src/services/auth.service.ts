// src/services/auth.service.ts

import axios from 'axios';
import api from "../utils/axios";
import { API_V1_URL } from '../config/env';
import {
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  UserResponse,
} from "../types/auth.types";

export async function registerUser(
  payload: RegisterPayload
): Promise<UserResponse> {
  const { data } = await api.post<UserResponse>(
    "/api/v1/auth/register",
    payload
  );
  return data;
}

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>(
    "/api/v1/auth/login",
    payload
  );
  return data;
}

export async function getMe(): Promise<UserResponse> {
  const { data } = await api.get<UserResponse>("/api/v1/auth/me");
  return data;
}

export interface ProfileUpdate {
  name?: string;
  username?: string;
  bio?: string;
  avatar?: string; // uploaded image URL, or "" to remove
  payment_handles?: { revolut?: string; paypal?: string; upi?: string }; // "" removes one
  display_currency?: string; // "" turns it off
}

export async function updateMe(payload: ProfileUpdate): Promise<UserResponse> {
  const { data } = await api.patch<UserResponse>("/api/v1/auth/me", payload);
  return data;
}

export async function verifyEmailCode(payload: { identifier: string; code: string }): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/api/v1/auth/verify-email", payload);
  return data;
}

export async function resendVerificationCode(payload: { identifier: string }): Promise<{ success: boolean; message?: string }> {
  const { data } = await api.post("/api/v1/auth/resend-code", payload);
  return data;
}

// Password reset runs signed out, so it uses plain axios (no token refresh on 401)
const API_URL = API_V1_URL;

class AuthService {
  /**
   * Request password reset email
   */
  async forgotPassword(identifier: string): Promise<any> {
    try {
      const response = await axios.post(`${API_URL}/auth/forgot-password`, {
        identifier
      });
      return response.data;
    } catch (error: any) {
      console.error('Forgot password error:', error);
      throw error;
    }
  }

  /**
   * Verify reset token is valid
   */
  async verifyResetToken(token: string): Promise<any> {
    try {
      const response = await axios.post(`${API_URL}/auth/verify-reset-token`, {
        token
      });
      return response.data;
    } catch (error: any) {
      console.error('Verify token error:', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<any> {
    try {
      const response = await axios.post(`${API_URL}/auth/reset-password`, {
        token,
        new_password: newPassword
      });
      return response.data;
    } catch (error: any) {
      console.error('Reset password error:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();


/** Everything the server holds about you, saved by the browser as a JSON file. */
export async function downloadMyData(): Promise<void> {
  const res = await api.get("/api/v1/auth/me/export", { responseType: "blob" });
  const name = /filename="([^"]+)"/.exec(res.headers["content-disposition"] || "")?.[1] || "papyris-data.json";
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Delete the account. Needs the password and the word DELETE. */
export async function deleteMyAccount(password: string, confirm: string): Promise<void> {
  await api.post("/api/v1/auth/me/delete", { password, confirm });
}
