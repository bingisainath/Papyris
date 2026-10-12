// src/services/e2e.service.ts
// Encryption keys on the server: your public keys, device linking, and other people's public keys
// (cached briefly). The server never gets private keys.

import api from '../utils/axios';
import { generateKeys, publicKeysOf } from '../crypto/e2e';
import type { KeyPairs, SealedKeys } from '../crypto/e2e';

const V1 = '/api/v1';
const CACHE_MS = 5 * 60 * 1000;

export interface MyKeys {
  has_keys: boolean;
  enc_public?: string;
  sign_public?: string;
}

export interface LinkRequest {
  id: string;
  ephemeral_public: string;
  code: string;
  device_name: string;
  expires_at: string;
  status?: 'waiting' | 'approved';
  payload?: SealedKeys;
}

export interface MemberKeys {
  enc: string | null;
  sign: string | null;
  previous_sign: string[];
}

export interface ConversationKeys {
  members: Record<string, MemberKeys>;
  missing: string[]; // members holding up encryption (no version 2 yet): the chat stays unencrypted until they sign in
  v1_missing?: string[]; // members without version 1 keys (version 1 sending needs everyone)
  v2_ready?: boolean; // every member has a version 2 device list
}

const conversationCache = new Map<string, { at: number; value: Promise<ConversationKeys> }>();
const userCache = new Map<string, { at: number; value: MemberKeys | null }>();

const fresh = (at: number) => Date.now() - at < CACHE_MS;

export const e2eService = {
  async mine(): Promise<MyKeys> {
    return (await api.get(`${V1}/keys/me`)).data.data;
  },

  /** First device (or a fresh start): create keys here and publish the public half. */
  async setUp(replace = false): Promise<KeyPairs> {
    const keys = generateKeys();
    const pub = publicKeysOf(keys);
    await api.put(`${V1}/keys/me`, { enc_public: pub.enc, sign_public: pub.sign, replace });
    return keys;
  },

  /** Start fresh with version 2 only: retire this account's version 1 keys (kept for checking old signatures). */
  async retireKeys(): Promise<void> {
    await api.delete(`${V1}/keys/me`);
  },

  // ---- linking another device (see crypto/linking.ts)
  async createLinkRequest(ephemeralPublic: string, deviceName: string): Promise<LinkRequest> {
    return (await api.post(`${V1}/keys/link-requests`, { ephemeral_public: ephemeralPublic, device_name: deviceName })).data.data;
  },
  async linkRequest(id: string): Promise<LinkRequest> {
    return (await api.get(`${V1}/keys/link-requests/${id}`)).data.data;
  },
  async findLinkRequest(code: string): Promise<LinkRequest> {
    return (await api.get(`${V1}/keys/link-requests`, { params: { code } })).data.data;
  },
  async approveLink(id: string, payload: SealedKeys): Promise<void> {
    await api.post(`${V1}/keys/link-requests/${id}/approve`, { payload });
  },
  async cancelLink(id: string): Promise<void> {
    await api.delete(`${V1}/keys/link-requests/${id}`);
  },

  conversationKeys(conversationId: string, force = false): Promise<ConversationKeys> {
    const cached = conversationCache.get(conversationId);
    if (cached && !force && fresh(cached.at)) return cached.value;
    const value = api.get(`${V1}/conversations/${conversationId}/keys`).then((r) => r.data.data as ConversationKeys);
    value.catch(() => conversationCache.delete(conversationId));
    conversationCache.set(conversationId, { at: Date.now(), value });
    return value;
  },

  /** Public keys of these people (null for anyone without encryption, or we don't share a chat). */
  async userKeys(userIds: string[]): Promise<Record<string, MemberKeys | null>> {
    const wanted = Array.from(new Set(userIds)).filter((id) => {
      const c = userCache.get(id);
      return !c || !fresh(c.at);
    });
    if (wanted.length) {
      const found: Record<string, MemberKeys> = (await api.get(`${V1}/keys`, { params: { user_ids: wanted.join(',') } })).data.data;
      for (const id of wanted) userCache.set(id, { at: Date.now(), value: found[id] || null });
    }
    return Object.fromEntries(userIds.map((id) => [id, userCache.get(id)?.value ?? null]));
  },

  /** Someone set up or reset their keys, or a chat's members changed: fetch again next time. */
  forgetUser(userId?: string) {
    if (userId) userCache.delete(userId);
    else userCache.clear();
    conversationCache.clear();
  },

  forgetConversation(conversationId: string) {
    conversationCache.delete(conversationId);
  },
};
