// Four or more photos in a row from one person become an album.
// Only the grouping is tested: stub what the tiles draw with
jest.mock('lucide-react-native', () => ({}));
jest.mock('../../crypto/media', () => ({ useMediaSrc: () => ({ failed: false }) }));
jest.mock('../common/Avatar', () => () => null);

import { groupAlbums } from './AlbumGrid';
import type { Message } from '../../api/chat';

const photo = (id: string, extra: Partial<Message> = {}): Message => ({
  id, conversationId: 'c1', senderId: 'bob', text: '', timestamp: '2026-10-15T10:00:00.000Z',
  mediaType: 'image', mediaUrl: `/media/${id}.enc`, mediaKey: 'k', reactions: [], ...extra,
} as Message);

test('four photos in a row are an album', () => {
  const items = groupAlbums(['a', 'b', 'c', 'd'].map((id) => photo(id)));
  expect(items).toHaveLength(1);
  expect(items[0].kind).toBe('album');
});

test('a photo still waiting for its key is shown on its own, not as an album tile', () => {
  const items = groupAlbums([photo('a'), photo('b'), photo('c', { e2e: 'pending', mediaKey: undefined }), photo('d')]);
  expect(items.map((i) => i.kind)).toEqual(['message', 'message', 'message', 'message']);
});
