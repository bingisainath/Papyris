// src/store/notices.ts
// Notices from the ShareEven team (warnings, report outcomes), for the chat list banner and
// Settings → Notices. Loaded on first use, then kept current by the live "account_notice" event.
// Same as web/src/hooks/useNotices.ts.
import { create } from 'zustand';
import { safetyApi } from '../api/safety';
import type { Notice } from '../api/safety';
import { socket } from '../websocket/socket';

interface NoticesState {
  notices: Notice[];
  unread: number;
  loaded: boolean;
  load: () => Promise<void>;
  /** Opening Settings → Notices reads them all. */
  readAll: () => void;
  /** Signing out. */
  clear: () => void;
}

export const useNotices = create<NoticesState>((set, get) => ({
  notices: [],
  unread: 0,
  loaded: false,
  load: async () => {
    try {
      const { notices, unread } = await safetyApi.notices();
      set({ notices, unread, loaded: true });
    } catch {
      // offline: tried again next time
    }
  },
  readAll: () => {
    if (!get().unread) return;
    set((s) => ({ notices: s.notices.map((n) => ({ ...n, read: true })), unread: 0 }));
    safetyApi.readNotices().catch(() => undefined);
  },
  clear: () => set({ notices: [], unread: 0, loaded: false }),
}));

socket.on((e) => {
  if (e.type !== 'account_notice' || !e.notice) return;
  const notice = e.notice as Notice;
  const { notices, unread } = useNotices.getState();
  if (notices.some((n) => n.id === notice.id)) return;
  useNotices.setState({ notices: [notice, ...notices], unread: unread + 1 });
});
