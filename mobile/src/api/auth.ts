// src/api/auth.ts
import { api, data } from './client';

export interface User {
  id: string;
  username: string;
  email: string;
  name?: string | null;
  bio?: string | null;
  avatar?: string | null;
  email_verified?: boolean;
  created_at: string;
  payment_handles?: { revolut?: string; paypal?: string; upi?: string } | null; // where people can pay you
}

export interface TokenPair {
  access_token: string;
  refresh_token?: string;
}

export const authApi = {
  login: (identifier: string, password: string) => data<TokenPair>(api.post('/auth/login', { identifier, password })),
  register: (username: string, email: string, password: string) =>
    data<User>(api.post('/auth/register', { username, email, password })),
  verifyEmail: (identifier: string, code: string) => data<TokenPair>(api.post('/auth/verify-email', { identifier, code })),
  resendCode: (identifier: string) => api.post('/auth/resend-code', { identifier }),
  forgotPassword: (identifier: string) => api.post('/auth/forgot-password', { identifier }),
  me: () => data<User>(api.get('/auth/me')),
  updateMe: (patch: { name?: string; username?: string; bio?: string; avatar?: string; payment_handles?: { revolut?: string; paypal?: string; upi?: string } }) =>
    data<User>(api.patch('/auth/me', patch)),
};
