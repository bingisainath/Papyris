// Registering this phone for notifications: after sign-in it may ask; on reconnect it never asks.
const posts: any[] = [];
jest.mock('../api/client', () => ({ api: { post: jest.fn(async (...args: any[]) => { posts.push(args); }) } }));
jest.mock('@react-native-firebase/app', () => ({ getApps: () => [{}] }));
jest.mock('@react-native-firebase/messaging', () => ({
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
  getMessaging: () => ({}),
  getToken: async () => 'new-token-after-reinstall-0123456789',
  onTokenRefresh: () => () => undefined,
  hasPermission: async () => 1,
  requestPermission: async () => 1,
  getInitialNotification: async () => null,
  onNotificationOpenedApp: () => () => undefined,
}));

import { PermissionsAndroid, Platform } from 'react-native';
import { enablePush } from './push';

beforeEach(() => {
  posts.length = 0;
  Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
  Object.defineProperty(Platform, 'Version', { get: () => 34, configurable: true });
});

test('on reconnect, an allowed phone registers its current token without a prompt', async () => {
  const request = jest.spyOn(PermissionsAndroid, 'request');
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
  await enablePush({ ask: false });
  expect(request).not.toHaveBeenCalled();
  expect(posts).toEqual([['/devices', { token: 'new-token-after-reinstall-0123456789', platform: 'android', renders_messages: false }]]);
});

test('on reconnect, a phone with notifications turned off is left alone', async () => {
  const request = jest.spyOn(PermissionsAndroid, 'request');
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  await enablePush({ ask: false });
  expect(request).not.toHaveBeenCalled();
  expect(posts).toEqual([]);
});

test('after sign-in it asks, then registers', async () => {
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  await enablePush();
  expect(PermissionsAndroid.request).toHaveBeenCalled();
  expect(posts).toHaveLength(1);
});
