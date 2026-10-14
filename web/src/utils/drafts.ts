// src/utils/drafts.ts
// Unsent text per chat, so switching chats or reloading the page doesn't lose it. Kept in this
// browser only (never sent anywhere) and wiped on logout, like the chats themselves.

const PREFIX = 'se:draft:';

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback; // storage blocked (private window) or full: drafts just don't persist
  }
};

export const chatDrafts = {
  get: (conversationId: string): string => safe(() => localStorage.getItem(PREFIX + conversationId) || '', ''),
  set: (conversationId: string, text: string): void => safe(() => {
    if (text.trim()) localStorage.setItem(PREFIX + conversationId, text);
    else localStorage.removeItem(PREFIX + conversationId);
  }, undefined),
  clearAll: (): void => safe(() => {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  }, undefined),
};
