// Live events update chats and messages the same way as the web app.
const listeners: Array<(e: any) => void> = [];
const sent: any[] = [];

jest.mock('../src/ws/socket', () => ({
  socket: {
    on: (l: any) => { listeners.push(l); return () => undefined; },
    onStatus: () => () => undefined,
    sendMessage: (...args: any[]) => { sent.push(args); return true; },
    join: jest.fn(), leave: jest.fn(), read: jest.fn(), typing: jest.fn(),
  },
}));
jest.mock('../src/api/chat', () => ({
  chatApi: { conversations: jest.fn(async () => []), markRead: jest.fn(async () => undefined), messages: jest.fn() },
}));

import { typingNames, useChat } from '../src/store/chat';

const emit = (e: any) => listeners.forEach((l) => l(e));
// Sending first checks whether the chat is end-to-end encrypted (async)
const settle = () => new Promise<void>((r) => setTimeout(() => r(), 0));
const conversation = { id: 'c1', name: 'Flat', lastMessage: '', lastMessageTime: null, unreadCount: 0, isGroup: true, members: ['me', 'bob'], isPinned: false, pinnedAt: null };

beforeEach(() => {
  sent.length = 0;
  useChat.setState({ conversations: [conversation], messages: { c1: [] }, typing: {}, online: [], activeId: null });
});

test('sending shows the message at once and the server copy replaces it', async () => {
  useChat.getState().send('c1', 'hi', { id: 'me', username: 'me' });
  const [pending] = useChat.getState().messages.c1;
  expect(pending.status).toBe('sending');
  await settle();
  // No encryption keys in this test: sent as plain text (no media, no link flag)
  expect(sent[0]).toEqual(['c1', pending.id, 'hi', undefined, undefined, undefined]);

  emit({ type: 'message', roomId: 'c1', messageId: 'm1', clientId: pending.id, senderId: 'me', text: 'hi', timestamp: new Date().toISOString(), status: 'sent' });
  const list = useChat.getState().messages.c1;
  expect(list).toHaveLength(1);
  expect(list[0].id).toBe('m1');
});

test('messages from others count as unread unless the chat is open', () => {
  emit({ type: 'message', roomId: 'c1', messageId: 'm2', senderId: 'bob', text: 'yo', timestamp: new Date().toISOString() });
  expect(useChat.getState().conversations[0].unreadCount).toBe(1);
  expect(useChat.getState().conversations[0].lastMessage).toBe('yo');

  useChat.setState({ activeId: 'c1' });
  emit({ type: 'message', roomId: 'c1', messageId: 'm3', senderId: 'bob', text: 'again', timestamp: new Date().toISOString() });
  expect(useChat.getState().conversations[0].unreadCount).toBe(1);
});

test('read receipts, reactions, edits, deletes, typing and presence', () => {
  const t = new Date(Date.now() - 1000).toISOString();
  useChat.setState({ messages: { c1: [{ id: 'm1', conversationId: 'c1', senderId: 'me', text: 'hi', timestamp: t, status: 'sent', reactions: [] }] } });

  emit({ type: 'read', roomId: 'c1', readUpTo: new Date().toISOString() });
  expect(useChat.getState().messages.c1[0].status).toBe('read');

  emit({ type: 'reactions_updated', roomId: 'c1', messageId: 'm1', reactions: [{ emoji: '👍', userIds: ['bob'] }] });
  expect(useChat.getState().messages.c1[0].reactions).toEqual([{ emoji: '👍', userIds: ['bob'] }]);

  emit({ type: 'message_updated', roomId: 'c1', messageId: 'm1', text: 'hello', editedAt: t });
  expect(useChat.getState().messages.c1[0].text).toBe('hello');
  emit({ type: 'message_updated', roomId: 'c1', messageId: 'm1', isDeleted: true });
  expect(useChat.getState().messages.c1[0].isDeleted).toBe(true);

  emit({ type: 'typing', roomId: 'c1', userId: 'bob', userName: 'Bob', isTyping: true });
  expect(typingNames(useChat.getState().typing, 'c1')).toEqual(['Bob']);
  emit({ type: 'typing', roomId: 'c1', userId: 'bob', isTyping: false });
  expect(typingNames(useChat.getState().typing, 'c1')).toEqual([]);

  emit({ type: 'presence', userIds: ['bob'] });
  emit({ type: 'online', userId: 'carol' });
  emit({ type: 'offline', userId: 'bob' });
  expect(useChat.getState().online).toEqual(['carol']);
});

test('a rejected send is marked failed and can be retried', async () => {
  useChat.getState().send('c1', 'oops', { id: 'me', username: 'me' });
  await settle();
  const [pending] = useChat.getState().messages.c1;
  emit({ type: 'error', roomId: 'c1', clientId: pending.id, message: 'Not a member' });
  expect(useChat.getState().messages.c1[0].status).toBe('failed');
  useChat.getState().retry('c1', pending.id);
  expect(useChat.getState().messages.c1[0].status).toBe('sending');
  await settle();
  expect(sent).toHaveLength(2);
});

test('a chat read on the phone stays read even if the server is a moment behind', async () => {
  const { chatApi } = require('../src/api/chat');
  const now = new Date().toISOString();
  useChat.getState().open('c1');
  emit({ type: 'message', roomId: 'c1', messageId: 'm9', senderId: 'bob', text: 'hi', timestamp: now });
  useChat.getState().open(null);
  expect(chatApi.markRead).toHaveBeenCalledWith('c1');
  // The server still says 1 unread (it hasn't processed the read yet)
  chatApi.conversations.mockResolvedValueOnce([{ ...conversation, unreadCount: 1, lastMessageTime: now }]);
  await useChat.getState().loadConversations();
  expect(useChat.getState().conversations[0].unreadCount).toBe(0);
  // A newer message is unread again
  chatApi.conversations.mockResolvedValueOnce([{ ...conversation, unreadCount: 1, lastMessageTime: new Date(Date.now() + 60000).toISOString() }]);
  await useChat.getState().loadConversations();
  expect(useChat.getState().conversations[0].unreadCount).toBe(1);
});
