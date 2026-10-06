// src/utils/notifications.ts
// Desktop notifications for incoming messages (opt-in from Settings).

import { resolveMediaUrl } from './media';
import { NAVIGATE_EVENT } from './events';
import appIcon from '../assets/images/icon.png';

const PREF_KEY = 'papyris_notifications';

export type NotificationStatus = 'unsupported' | 'denied' | 'off' | 'on';

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

/** Current state, combining browser permission and the user's on/off preference */
export function getNotificationStatus(): NotificationStatus {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  try {
    return localStorage.getItem(PREF_KEY) === 'off' ? 'off' : 'on';
  } catch {
    return 'on';
  }
}

/** Turn notifications on (asking for permission if needed) or off */
export async function setNotificationsEnabled(enabled: boolean): Promise<NotificationStatus> {
  if (!notificationsSupported()) return 'unsupported';
  if (enabled && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  try {
    localStorage.setItem(PREF_KEY, enabled ? 'on' : 'off');
  } catch {
    // Storage unavailable: the browser permission alone decides
  }
  return getNotificationStatus();
}

/**
 * Show a notification for a new message, unless the user is already looking at that chat.
 * Notifications for the same conversation replace each other (tag).
 */
export function notifyNewMessage(options: {
  conversationId: string;
  title: string;
  body: string;
  icon?: string | null;
}) {
  if (getNotificationStatus() !== 'on') return;

  const viewingThisChat =
    document.visibilityState === 'visible' &&
    document.hasFocus() &&
    (window as any).__activeConversationId === options.conversationId;
  if (viewingThisChat) return;

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: resolveMediaUrl(options.icon) || appIcon,
      tag: options.conversationId,
    });
    notification.onclick = () => {
      window.focus();
      window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: `/chat/${options.conversationId}` }));
      notification.close();
    };
  } catch (error) {
    // Some browsers (e.g. Android Chrome) only allow notifications from a service worker
    console.warn('Notification failed:', error);
  }
}
