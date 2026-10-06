// src/config/env.ts
// Single source for backend URLs. Override in web/.env (see .env.example).

const trimSlash = (url: string) => url.replace(/\/+$/, '');

export const API_BASE_URL = trimSlash(
  process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000'
);

export const API_V1_URL = `${API_BASE_URL}/api/v1`;

export const WS_URL =
  process.env.REACT_APP_WS_URL || `${API_BASE_URL.replace(/^http/, 'ws')}/api/v1/ws/chat`;
