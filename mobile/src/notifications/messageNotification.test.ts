// Chat notifications show the decrypted message, or the server's text when it can't be read in time.
const mockShown: any[] = [];
const mockLocal: Record<string, any> = {};
const mockState = { ready: true };

jest.mock('react-native', () => ({ NativeModules: { ShareEvenNotifications: { showMessage: (m: any) => mockShown.push(m) } } }));
jest.mock('../api/tokens', () => ({ tokens: { access: 'x.eyJzdWIiOiJhbGljZSJ9.y', load: async () => true } }));
jest.mock('../crypto/v2-platform/runtime', () => ({ v2Runtime: () => (mockState.ready ? Promise.resolve({}) : null), startV2IfSetUp: async () => null }));
jest.mock('../crypto/v2-platform/chat', () => ({
  localFor: async (id: string) => mockLocal[id] ?? null,
  fromLocal: (m: any) => ({ text: m.text, mediaType: m.mediaType }),
}));
jest.mock('../store/chat', () => ({ syncV2: async () => undefined }));

import { serverPreview, showMessageNotification } from './messageNotification';

const push = (extra: Record<string, string>) => ({
  type: 'message', conversationId: 'c1', messageId: 'm1', sender: 'bob', chat: 'Flat 4B', encrypted: '1', hideText: '',
  title: 'Flat 4B', body: 'bob: New message', ...extra,
});

beforeEach(() => {
  mockShown.length = 0;
  Object.keys(mockLocal).forEach((k) => delete mockLocal[k]);
  mockState.ready = true;
});

test("the server's group text loses the sender in front (the notification names the sender itself)", () => {
  expect(serverPreview(push({}))).toBe('New message');
  expect(serverPreview(push({ chat: '', body: 'Photo' }))).toBe('Photo');
});

test('an encrypted message shows its decrypted text', async () => {
  mockLocal.m1 = { text: 'dinner at 8?' };
  await showMessageNotification(push({}));
  expect(mockShown).toEqual([{ conversationId: 'c1', sender: 'bob', text: 'dinner at 8?', chat: 'Flat 4B' }]);
});

test("a photo without a caption says Photo; one this phone can't read keeps the server's text", async () => {
  mockLocal.m1 = { text: '', mediaType: 'image' };
  await showMessageNotification(push({}));
  mockState.ready = false; // not set up on this phone
  await showMessageNotification(push({ messageId: 'm2' }));
  expect(mockShown.map((m) => m.text)).toEqual(['Photo', 'New message']);
});

test('with message text hidden by the server, the phone keeps it hidden too', async () => {
  mockLocal.m1 = { text: 'secret' };
  await showMessageNotification(push({ hideText: '1' }));
  expect(mockShown[0].text).toBe('New message');
});
