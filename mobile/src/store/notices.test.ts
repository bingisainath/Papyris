// Notices from the ShareEven team: loaded once, new ones arrive live, opening Notices reads them.
const listeners: Array<(e: any) => void> = [];
jest.mock('../websocket/socket', () => ({ socket: { on: (l: any) => { listeners.push(l); return () => undefined; } } }));
const mockRead = jest.fn(async () => undefined);
jest.mock('../api/safety', () => ({
  safetyApi: {
    notices: jest.fn(async () => ({ notices: [{ id: 'n1', kind: 'report_update', title: 'Update on your report', body: '…', reason: 'action_taken', created_at: '2026-10-15T10:00:00Z', read: false }], unread: 1 })),
    readNotices: (...args: unknown[]) => mockRead(...(args as [])),
  },
}));

import { useNotices } from './notices';

const warning = { id: 'n2', kind: 'warning', title: 'Warning from the ShareEven team', body: '…', reason: 'spam', created_at: '2026-10-15T11:00:00Z', read: false };

test('loads, takes live notices once each, and reading clears the count', async () => {
  await useNotices.getState().load();
  expect(useNotices.getState().unread).toBe(1);

  listeners.forEach((l) => l({ type: 'account_notice', notice: warning }));
  listeners.forEach((l) => l({ type: 'account_notice', notice: warning })); // same one again: ignored
  expect(useNotices.getState().notices.map((n) => n.id)).toEqual(['n2', 'n1']);
  expect(useNotices.getState().unread).toBe(2);

  useNotices.getState().readAll();
  expect(useNotices.getState().unread).toBe(0);
  expect(useNotices.getState().notices.every((n) => n.read)).toBe(true);
  expect(mockRead).toHaveBeenCalledTimes(1);

  useNotices.getState().clear(); // signing out
  expect(useNotices.getState()).toMatchObject({ notices: [], unread: 0, loaded: false });
});
