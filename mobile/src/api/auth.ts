// src/api/auth.ts
import ReactNativeBlobUtil from 'react-native-blob-util';
import { API_V1_URL } from '../config';
import { tokens } from './tokens';
import { api, data, refreshAccessToken } from './client';
import { saveLocalFile } from '../utils/save';

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
  display_currency?: string | null; // expense totals are also shown in this currency
}

export interface TokenPair {
  access_token: string;
  refresh_token?: string;
}

export const authApi = {
  login: (identifier: string, password: string) => data<TokenPair>(api.post('/auth/login', { identifier, password })),
  register: (username: string, email: string, password: string, emailTypoChecked = false) =>
    data<User>(api.post('/auth/register', { username, email, password, email_typo_checked: emailTypoChecked })),
  verifyEmail: (identifier: string, code: string) => data<TokenPair>(api.post('/auth/verify-email', { identifier, code })),
  resendCode: (identifier: string) => api.post('/auth/resend-code', { identifier }),
  forgotPassword: (identifier: string) => api.post('/auth/forgot-password', { identifier }),
  me: () => data<User>(api.get('/auth/me')),
  /** Delete the account. Needs the password and the word DELETE. */
  deleteAccount: (password: string, confirm: string) => api.post('/auth/me/delete', { password, confirm }),
  updateMe: (patch: { name?: string; username?: string; bio?: string; avatar?: string; payment_handles?: { revolut?: string; paypal?: string; upi?: string }; display_currency?: string }) =>
    data<User>(api.patch('/auth/me', patch)),
};

/** Everything the server holds about you, saved to Downloads as a JSON file. Returns its name. */
export async function saveMyData(): Promise<string> {
  const url = `${API_V1_URL}/auth/me/export`;
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/shareeven-data.json`;
  const get = () => ReactNativeBlobUtil.config({ path }).fetch('GET', url, { Authorization: `Bearer ${tokens.access}` });
  let res = await get();
  if (res.info().status === 401 && (await refreshAccessToken())) res = await get();
  if (res.info().status !== 200) {
    await ReactNativeBlobUtil.fs.unlink(path).catch(() => undefined);
    throw new Error(res.info().status === 429 ? "You've downloaded your data a few times already. Try again later." : "Couldn't prepare your data. Try again.");
  }
  const header = Object.entries(res.info().headers).find(([k]) => k.toLowerCase() === 'content-disposition')?.[1] || '';
  const name = /filename="([^"]+)"/.exec(String(header))?.[1] || 'shareeven-data.json';
  await saveLocalFile(path, name, 'application/json');
  return name;
}
