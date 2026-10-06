// src/utils/authRefresh.ts
// Renews the access token with the refresh token, and retries requests that got a 401.

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_V1_URL } from '../config/env';
import { tokenStore } from './token';

/** Fired on window when the session can't be renewed; AuthProvider logs the user out. */
export const SESSION_EXPIRED_EVENT = 'papyris:session-expired';

let inFlight: Promise<string | null> | null = null;

/**
 * Get a new access token. Concurrent callers share one request.
 * Resolves to null (and fires SESSION_EXPIRED_EVENT) if the session is over.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (inFlight) return inFlight;

  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return Promise.resolve(null);

  inFlight = axios
    // Plain axios call: must not go through the retry interceptor below
    .post(`${API_V1_URL}/auth/refresh`, { refresh_token: refreshToken })
    .then(response => {
      const data = response.data?.data;
      if (!data?.access_token) throw new Error('No access token in refresh response');
      tokenStore.set(data.access_token);
      if (data.refresh_token) tokenStore.setRefresh(data.refresh_token);
      return data.access_token as string;
    })
    .catch((error: AxiosError) => {
      // Only a rejected refresh token ends the session; network errors may be temporary
      if (error.response && [400, 401, 403].includes(error.response.status)) {
        tokenStore.clear();
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      return null;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

type RetriableConfig = InternalAxiosRequestConfig & { _authRetried?: boolean };

const isAuthEndpoint = (url = '') => /\/auth\/(login|register|refresh)/.test(url);

/** On a 401, refresh the token once and replay the request with the new token. */
export function installAuthRefresh(instance: AxiosInstance) {
  instance.interceptors.response.use(
    response => response,
    async (error: AxiosError) => {
      const config = error.config as RetriableConfig | undefined;
      if (error.response?.status !== 401 || !config || config._authRetried || isAuthEndpoint(config.url)) {
        return Promise.reject(error);
      }

      // Sessions from before refresh tokens existed can't be renewed
      if (!tokenStore.getRefresh()) {
        if (tokenStore.get()) {
          tokenStore.clear();
          window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
        }
        return Promise.reject(error);
      }

      config._authRetried = true;
      const token = await refreshAccessToken();
      if (!token) return Promise.reject(error);

      config.headers.set('Authorization', `Bearer ${token}`);
      return instance.request(config);
    }
  );
}
