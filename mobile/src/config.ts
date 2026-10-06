// src/config.ts
// Where the Papyris server is.
// Development on a USB-connected phone: `adb reverse tcp:8000 tcp:8000` makes the phone's
// localhost:8000 reach the API on your computer. Production: set your real HTTPS address.

const DEV_API = 'http://localhost:8000';
const PROD_API = 'https://api.papyris.app'; // change when the server is deployed

export const API_BASE_URL = __DEV__ ? DEV_API : PROD_API;
export const API_V1_URL = `${API_BASE_URL}/api/v1`;
export const WS_URL = `${API_BASE_URL.replace(/^http/, 'ws')}/api/v1/ws/chat`;

/** Media links from the server are relative (/api/v1/media/...). */
export const mediaUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  return url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
};
