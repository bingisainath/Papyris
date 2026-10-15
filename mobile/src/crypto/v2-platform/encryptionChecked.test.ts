// Sending waits for this phone's encryption check: before it, a chat can't tell encrypted from not.
import { v2For } from './chat';
import { markEncryptionChecked } from './runtime';

test('deciding how to encrypt waits until the encryption check is done', async () => {
  let decided = false;
  const decision = v2For({ conversationId: 'c1', isGroup: false, members: ['me', 'bob'] }).then((v) => { decided = true; return v; });
  await new Promise<void>((r) => setTimeout(r, 20));
  expect(decided).toBe(false);
  markEncryptionChecked();
  await expect(decision).resolves.toBeNull(); // no encryption runtime in this test
  expect(decided).toBe(true);
});
