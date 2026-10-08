// src/ws/socket.ts
// One live connection to the server for messages, typing, reads and presence.
// Same protocol as web/src/services/websocket.service.ts.

import { AppState, AppStateStatus } from 'react-native';
import { WS_URL } from '../config';
import { tokens } from '../auth/tokens';
import { refreshAccessToken } from '../api/client';

export type WsEvent = { type: string; [key: string]: any };

/** Attachment fields of a chat message (same as the web app's OutgoingMedia). */
export interface OutgoingMedia {
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'audio' | 'file';
  mediaSize?: number;
  mediaFilename?: string;
  mediaThumbnail?: string;
  mediaWidth?: number;
  mediaHeight?: number;
  mediaDuration?: number;
}
type Listener = (event: WsEvent) => void;

const HEARTBEAT_MS = 30_000;
const MAX_DELAY_MS = 30_000;

class Socket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<(connected: boolean) => void>();
  private rooms = new Set<string>();
  private wanted = false; // false after logout
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private appState: AppStateStatus = AppState.currentState;

  constructor() {
    AppState.addEventListener('change', (next) => {
      // Phones drop sockets in the background; reconnect as soon as the app is back
      if (this.appState.match(/inactive|background/) && next === 'active' && this.wanted && !this.connected) {
        this.attempts = 0;
        this.open();
      }
      this.appState = next;
    });
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  start() {
    this.wanted = true;
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) this.open();
  }

  stop() {
    this.wanted = false;
    this.rooms.clear();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close(1000);
    this.ws = null;
  }

  private open() {
    const token = tokens.access;
    if (!token) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.rooms.forEach((roomId) => this.send({ type: 'join', roomId }));
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = setInterval(() => this.send({ type: 'ping' }), HEARTBEAT_MS);
      this.statusListeners.forEach((l) => l(true));
    };
    ws.onmessage = (message) => {
      try {
        const event = JSON.parse(String(message.data)) as WsEvent;
        this.listeners.forEach((l) => l(event));
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = async (event) => {
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = null;
      if (this.ws === ws) this.ws = null;
      this.statusListeners.forEach((l) => l(false));
      if (!this.wanted) return;
      if (event.code === 1008) {
        // Token rejected (expired): renew it once, then reconnect
        const renewed = await refreshAccessToken();
        if (!renewed) return;
      }
      this.scheduleReconnect();
    };
    ws.onerror = () => undefined; // onclose follows
  }

  /** "Try now" from the offline banner: skip the wait before the next attempt. */
  retryNow() {
    if (!this.wanted || this.connected) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.attempts = 0;
    this.open();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.appState !== 'active') return;
    const delay = Math.min(MAX_DELAY_MS, 1000 * 2 ** this.attempts);
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.wanted) this.open();
    }, delay);
  }

  send(data: Record<string, unknown>): boolean {
    if (!this.connected) return false;
    this.ws!.send(JSON.stringify(data));
    return true;
  }

  join(roomId: string) {
    this.rooms.add(roomId);
    this.send({ type: 'join', roomId });
  }

  leave(roomId: string) {
    this.rooms.delete(roomId);
    this.send({ type: 'leave', roomId });
  }

  /** hasLink: encrypted messages tell the server whether there's a link (for the Links tab) */
  sendMessage(roomId: string, clientId: string, text: string, replyToId?: string, media?: OutgoingMedia, hasLink?: boolean) {
    return this.send({
      type: 'message', roomId, clientId, text, ...(replyToId ? { replyToId } : {}), ...(media || {}), ...(hasLink ? { hasLink: true } : {}),
    });
  }

  typing(roomId: string, isTyping: boolean) {
    this.send({ type: 'typing', roomId, isTyping });
  }

  read(roomId: string, lastMessageId: string) {
    this.send({ type: 'read', roomId, lastMessageId });
  }

  on(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onStatus(listener: (connected: boolean) => void) {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }
}

export const socket = new Socket();
