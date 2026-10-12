// src/notifications/push.ts
// Push notifications through Firebase Cloud Messaging.
// The server sends them when a message arrives (backend/app/services/push.py); here we ask
// permission, register this phone's token, and open the right chat when one is tapped.
// Until the Firebase config file is added (android/app/google-services.json,
// ios/GoogleService-Info.plist) there's no Firebase app and all of this quietly does nothing.

import { PermissionsAndroid, Platform } from 'react-native';
import { getApps } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  hasPermission,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';
import type { RemoteMessage } from '@react-native-firebase/messaging';
import { api } from '../api/client';

let currentToken: string | null = null;
let stopTokenRefresh: (() => void) | null = null;

const configured = () => getApps().length > 0;

async function allowed(): Promise<boolean> {
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) < 33) return true; // no runtime permission before Android 13
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  const status = await requestPermission(getMessaging());
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
}

async function register(token: string) {
  currentToken = token;
  await api.post('/devices', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
}

/** After sign-in: ask permission and register this phone. Safe to call more than once. */
export async function enablePush(): Promise<void> {
  if (!configured()) return;
  try {
    if (!(await allowed())) return;
    const messaging = getMessaging();
    await register(await getToken(messaging));
    stopTokenRefresh?.();
    stopTokenRefresh = onTokenRefresh(messaging, (token) => {
      register(token).catch(() => undefined);
    });
  } catch {
    // No network or Play Services: try again next sign-in / app start
  }
}

/**
 * For Settings: 'unavailable' when this build has no Firebase config, otherwise whether the phone
 * allows Papyris notifications ('off' = turned off in the phone's settings or never allowed).
 */
export async function pushStatus(): Promise<'unavailable' | 'on' | 'off'> {
  if (!configured()) return 'unavailable';
  try {
    if (Platform.OS === 'android') {
      if (Number(Platform.Version) < 33) return 'on';
      return (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) ? 'on' : 'off';
    }
    const status = await hasPermission(getMessaging());
    return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

/** Before logout: stop notifications to this phone for the account that's leaving. */
export async function disablePush(): Promise<void> {
  stopTokenRefresh?.();
  stopTokenRefresh = null;
  if (!currentToken) return;
  try {
    await api.post('/devices/remove', { token: currentToken });
  } catch {
    // the server forgets tokens Firebase reports as gone
  }
  currentToken = null;
}

/** Call `open(conversationId)` when a notification is tapped (app in background or closed). */
export function onNotificationTap(open: (conversationId: string) => void): () => void {
  if (!configured()) return () => undefined;
  const messaging = getMessaging();
  const handle = (message: RemoteMessage | null) => {
    const conversationId = message?.data?.conversationId;
    if (typeof conversationId === 'string' && conversationId) open(conversationId);
  };
  getInitialNotification(messaging).then(handle).catch(() => undefined);
  return onNotificationOpenedApp(messaging, handle);
}
