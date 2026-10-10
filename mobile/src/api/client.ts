// src/api/client.ts
// HTTP client: adds the login token, renews it on a 401 and retries once
// (same rules as web/src/utils/authRefresh.ts).

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_V1_URL } from '../config';
import { tokens } from '../auth/tokens';

export const api = axios.create({ baseURL: API_V1_URL, timeout: 30000 });

/** The server's message when this device's sign-in was logged out (backend app/services/sessions.py). */
export const LOGGED_OUT = 'This device was logged out';

let onSessionExpired: (loggedOut: boolean) => void = () => undefined;
export const setSessionExpiredHandler = (handler: (loggedOut: boolean) => void) => {
  onSessionExpired = handler;
};

api.interceptors.request.use((config) => {
  if (tokens.access) config.headers.set('Authorization', `Bearer ${tokens.access}`);
  return config;
});

let inFlight: Promise<string | null> | null = null;

/** New access token from the refresh token. Concurrent callers share one request. */
export function refreshAccessToken(): Promise<string | null> {
  if (inFlight) return inFlight;
  if (!tokens.refresh) return Promise.resolve(null);
  inFlight = axios
    .post(`${API_V1_URL}/auth/refresh`, { refresh_token: tokens.refresh }, { timeout: 15000 })
    .then(async (response) => {
      const data = response.data?.data;
      if (!data?.access_token) throw new Error('No access token');
      await tokens.save(data.access_token, data.refresh_token ?? tokens.refresh);
      return data.access_token as string;
    })
    .catch(async (error: AxiosError) => {
      // Only a rejected refresh token ends the session; network errors may be temporary
      if (error.response && [400, 401, 403].includes(error.response.status)) {
        await tokens.clear();
        const message = (error.response.data as { message?: unknown } | undefined)?.message;
        onSessionExpired(message === LOGGED_OUT); // logged out from another device: wipe this one
      }
      return null;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

type Retriable = InternalAxiosRequestConfig & { _authRetried?: boolean };
const isAuthEndpoint = (url = '') => /\/auth\/(login|register|refresh|verify-email|resend-code)/.test(url);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as Retriable | undefined;
    if (error.response?.status !== 401 || !config || config._authRetried || isAuthEndpoint(config.url)) {
      return Promise.reject(error);
    }
    config._authRetried = true;
    const token = await refreshAccessToken();
    if (!token) return Promise.reject(error);
    config.headers.set('Authorization', `Bearer ${token}`);
    return api.request(config);
  },
);

/** The server's message for an error, or a plain fallback. */
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof message === 'string' && message) return message;
    if (!error.response) return "Can't reach Papyris. Check your connection.";
    return `Something went wrong (${error.response.status}). Please try again.`;
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

/** Unwrap {success, data} responses. */
export const data = <T,>(promise: Promise<{ data: { data: T } }>) => promise.then((r) => r.data.data);
