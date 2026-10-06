import reducer, {
  addMessage,
  applyMessageUpdate,
  clearUnreadCount,
  incrementUnreadCount,
  markMessagesRead,
  prependMessages,
  setConversations,
  setMessages,
  syncOnlineStatus,
  upsertMessage,
} from './chatSlice';
import type { Message } from './chatSlice';

const CONV = 'conv-1';
const at = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 12, 0, seconds)).toISOString();

const msg = (id: string, seconds: number, extra: Partial<Message> = {}): Message => ({
  id,
  conversationId: CONV,
  senderId: 'alice',
  text: id,
  timestamp: at(seconds),
  status: 'delivered',
  ...extra,
});

const stateWith = (messages: Message[]) => reducer(undefined, setMessages({ conversationId: CONV, messages }));
const ids = (state: ReturnType<typeof reducer>) => (state.messages[CONV] || []).map(m => m.id);

describe('optimistic messages', () => {
  it('replaces the optimistic copy when the server echoes its clientId', () => {
    let state = reducer(undefined, addMessage({ conversationId: CONV, message: msg('temp-1', 5, { status: 'sending' }) }));
    state = reducer(state, upsertMessage({ conversationId: CONV, message: msg('real-1', 6, { clientId: 'temp-1', status: 'sent' }) }));
    expect(ids(state)).toEqual(['real-1']);
    expect(state.messages[CONV][0].status).toBe('sent');
  });

  it("doesn't let one person's message replace another pending message", () => {
    let state = reducer(undefined, addMessage({ conversationId: CONV, message: msg('temp-mine', 5, { status: 'sending' }) }));
    state = reducer(state, upsertMessage({ conversationId: CONV, message: msg('from-bob', 6, { senderId: 'bob' }) }));
    expect(ids(state)).toEqual(['temp-mine', 'from-bob']);
  });

  it('ignores duplicates of the same server message', () => {
    let state = stateWith([msg('a', 1)]);
    state = reducer(state, upsertMessage({ conversationId: CONV, message: msg('a', 1) }));
    expect(ids(state)).toEqual(['a']);
  });
});

describe('setMessages (fetching a page)', () => {
  it('keeps pending sends, newer live messages and older loaded pages', () => {
    let state = stateWith([msg('old', 1), msg('b', 10), msg('c', 11)]);
    state = reducer(state, addMessage({ conversationId: CONV, message: msg('temp-x', 30, { status: 'sending' }) }));
    state = reducer(state, addMessage({ conversationId: CONV, message: msg('live', 20) }));
    // re-fetch returns only the newest page (b, c)
    state = reducer(state, setMessages({ conversationId: CONV, messages: [msg('b', 10), msg('c', 11)], hasMore: true }));
    expect(ids(state)).toEqual(['old', 'b', 'c', 'live', 'temp-x']);
    expect(state.hasMoreMessages[CONV]).toBe(true);
  });

  it('prepends older messages in order without duplicates', () => {
    let state = stateWith([msg('c', 3), msg('d', 4)]);
    state = reducer(state, prependMessages({ conversationId: CONV, messages: [msg('a', 1), msg('b', 2), msg('c', 3)], hasMore: false }));
    expect(ids(state)).toEqual(['a', 'b', 'c', 'd']);
    expect(state.hasMoreMessages[CONV]).toBe(false);
  });
});

describe('read receipts', () => {
  it('marks messages up to readUpTo as read, leaving pending ones alone', () => {
    let state = stateWith([msg('a', 1, { status: 'sent' }), msg('b', 2, { status: 'delivered' }), msg('c', 3, { status: 'sent' })]);
    state = reducer(state, addMessage({ conversationId: CONV, message: msg('temp', 2, { status: 'sending' }) }));
    state = reducer(state, markMessagesRead({ conversationId: CONV, readUpTo: at(2) }));
    const status = Object.fromEntries(state.messages[CONV].map(m => [m.id, m.status]));
    expect(status).toEqual({ a: 'read', b: 'read', temp: 'sending', c: 'sent' });
  });
});

describe('edits and deletes', () => {
  it('edits text and updates quotes of that message', () => {
    let state = stateWith([
      msg('orig', 1),
      msg('reply', 2, { replyTo: { id: 'orig', text: 'orig', senderId: 'alice' } }),
    ]);
    state = reducer(state, applyMessageUpdate({ conversationId: CONV, messageId: 'orig', text: 'fixed', editedAt: at(5) }));
    expect(state.messages[CONV][0]).toMatchObject({ text: 'fixed', editedAt: at(5) });
    expect(state.messages[CONV][1].replyTo?.text).toBe('fixed');
  });

  it('clears content and reactions when deleted', () => {
    let state = stateWith([msg('m', 1, { mediaUrl: '/x.png', mediaType: 'image', reactions: [{ emoji: '👍', userIds: ['bob'] }] })]);
    state = reducer(state, applyMessageUpdate({ conversationId: CONV, messageId: 'm', isDeleted: true }));
    expect(state.messages[CONV][0]).toMatchObject({ isDeleted: true, text: '', mediaUrl: undefined, reactions: [] });
  });
});

describe('conversation list', () => {
  const conversations = [
    { id: 'dm', name: 'Bob', members: ['me', 'bob'], isGroup: false, unreadCount: 0 },
    { id: 'group', name: 'Team', members: ['me', 'bob', 'carol'], isGroup: true, unreadCount: 2 },
  ];

  it('counts and clears unread messages', () => {
    let state = reducer(undefined, setConversations(conversations));
    state = reducer(state, incrementUnreadCount('dm'));
    state = reducer(state, incrementUnreadCount('dm'));
    state = reducer(state, clearUnreadCount('group'));
    expect(state.conversations.map(c => c.unreadCount)).toEqual([2, 0]);
  });

  it('sets DM online flags from a presence snapshot', () => {
    let state = reducer(undefined, setConversations(conversations));
    state = reducer(state, syncOnlineStatus({ onlineUserIds: ['bob', 'me'], currentUserId: 'me' }));
    expect(state.conversations[0].isOnline).toBe(true);
    state = reducer(state, syncOnlineStatus({ onlineUserIds: ['me'], currentUserId: 'me' }));
    expect(state.conversations[0].isOnline).toBe(false);
  });
});
