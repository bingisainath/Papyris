// src/services/messageSearch.ts (same as web/src/services/messageSearch.ts)
// Message search: the server searches chats it can read; end-to-end encrypted chats are searched in
// this phone's own encrypted database (like Signal). Results are merged, newest first.
// Older version 1 encrypted messages aren't searchable.

import { chatApi } from '../api/chat';
import { searchLocal } from '../crypto/v2-platform/chat';

export interface SearchHit {
  id: string; // the server's message id (to jump to it in the chat)
  conversationId: string;
  senderId: string | null;
  senderName: string | null;
  text: string;
  timestamp: string;
  encrypted: boolean;
}

export async function searchMessages(query: string, conversationId?: string, limit = 50): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const [server, local] = await Promise.all([
    chatApi.search(q, conversationId).catch(() => []),
    searchLocal(q, conversationId).catch(() => []),
  ]);
  const hits: SearchHit[] = [
    ...server.map((m) => ({ id: m.id, conversationId: m.conversationId, senderId: m.senderId, senderName: m.senderName, text: m.text, timestamp: m.timestamp, encrypted: false })),
    ...local.filter((m) => m.serverId).map((m) => ({
      id: m.serverId!, conversationId: m.conv, senderId: m.sender.user, senderName: null,
      text: m.text || m.media?.[0]?.name || 'Attachment', timestamp: new Date(m.ts).toISOString(), encrypted: true,
    })),
  ];
  const seen = new Set<string>();
  return hits
    .filter((h) => (seen.has(h.id) ? false : (seen.add(h.id), true)))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}
