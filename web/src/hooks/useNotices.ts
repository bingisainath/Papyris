// src/hooks/useNotices.ts
// Notices from the ShareEven team (warnings, report outcomes), shared by the chat list banner and
// Settings → Notices. Loaded once, then kept current by the server's live "account_notice" event.

import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { safetyService } from '../services/safety.service';
import type { Notice } from '../services/safety.service';
import { wsService } from '../services/websocket.service';

interface State { notices: Notice[]; unread: number; loaded: boolean }

let state: State = { notices: [], unread: 0, loaded: false };
const listeners = new Set<(s: State) => void>();
let loading: Promise<void> | null = null;
let listening = false;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
}

function load(): Promise<void> {
  loading ??= safetyService.notices()
    .then(({ notices, unread }) => set({ notices, unread, loaded: true }))
    .catch(() => undefined)
    .finally(() => { loading = null; });
  return loading;
}

function listen() {
  if (listening) return;
  listening = true;
  wsService.on('account_notice', (event) => {
    const notice = (event as unknown as { notice?: Notice }).notice;
    if (!notice || state.notices.some((n) => n.id === notice.id)) return;
    set({ notices: [notice, ...state.notices], unread: state.unread + 1 });
    toast.info(notice.title);
  });
}

/** Mark every notice read (opening Settings → Notices). */
export function readAllNotices() {
  if (!state.unread) return;
  set({ notices: state.notices.map((n) => ({ ...n, read: true })), unread: 0 });
  safetyService.readNotices().catch(() => undefined);
}

/** Forget them (signing out). */
export function clearNotices() {
  set({ notices: [], unread: 0, loaded: false });
}

export function useNotices(): State {
  const [current, setCurrent] = useState(state);
  useEffect(() => {
    listeners.add(setCurrent);
    listen();
    if (!state.loaded) load();
    return () => { listeners.delete(setCurrent); };
  }, []);
  return current;
}
