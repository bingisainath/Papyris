// Phase 6: security codes, verifying by QR, and key-change notices.

import {
  acceptKeyChange, acknowledgeKeyChange, b64, checkVerificationQr, setVerified, startFreshAccount, trustOf, verificationQr,
} from './index';
import { Device, Server } from './testing';

async function setup() {
  const server = new Server();
  const alice = await new Device(server, 'alice', 'Alice phone').start();
  const bob = await new Device(server, 'bob', 'Bob phone').start();
  await alice.send('dm', false, ['alice', 'bob'], 'hi'); // both sides learn each other's keys
  await bob.read();
  await alice.messenger.ready(['alice', 'bob']);
  await bob.messenger.ready(['alice', 'bob']);
  return { server, alice, bob };
}

/** Bob loses his phone and starts fresh on a new one. */
async function bobStartsFresh(server: Server) {
  const bob2 = new Device(server, 'bob', 'Bob new phone');
  await bob2.manager.bootstrap();
  await startFreshAccount(bob2.store, server.http('bob'), 'bob');
  return bob2.start();
}

describe('security codes', () => {
  it('are the same on both sides and 60 digits long', async () => {
    const { alice, bob } = await setup();
    const a = await trustOf(alice.store, 'alice', 'bob');
    const b = await trustOf(bob.store, 'bob', 'alice');
    expect(a.code).toBe(b.code);
    expect(a.code!.replace(/ /g, '')).toMatch(/^\d{60}$/);
    expect(a.verified).toBe(false);
  });

  it("scanning the other person's QR code verifies them; a wrong one doesn't", async () => {
    const { alice, bob } = await setup();
    const shownByBob = (await verificationQr(bob.store, 'bob', 'alice'))!;
    expect(await checkVerificationQr(alice.store, 'alice', 'bob', shownByBob)).toBe('match');
    expect((await trustOf(alice.store, 'alice', 'bob')).verified).toBe(true);
    const forged = shownByBob.replace(/:bob:[^:]+:/, ':bob:' + b64(new Uint8Array(32).fill(7)) + ':');
    expect(await checkVerificationQr(alice.store, 'alice', 'bob', forged)).toBe('mismatch');
    expect(await checkVerificationQr(alice.store, 'alice', 'bob', 'https://example.com')).toBe('other');
    const ownCode = (await verificationQr(alice.store, 'alice', 'bob'))!; // scanning your own screen isn't a match
    expect(await checkVerificationQr(alice.store, 'alice', 'bob', ownCode)).toBe('other');
  });
});

describe('when a contact starts fresh', () => {
  it('an unverified contact: a one-time notice, and messages keep flowing', async () => {
    const { server, alice } = await setup();
    const before = (await trustOf(alice.store, 'alice', 'bob')).code;
    const bob2 = await bobStartsFresh(server);
    alice.messenger.forget('bob');
    await alice.send('dm', false, ['alice', 'bob'], 'still there?');
    expect(await bob2.read()).toEqual(['still there?']);
    const t = await trustOf(alice.store, 'alice', 'bob');
    expect(t.changedAt).toBeDefined();
    expect(t.code).not.toBe(before);
    expect(t.needsAccept).toBe(false);
    await acknowledgeKeyChange(alice.store, 'bob');
    expect((await trustOf(alice.store, 'alice', 'bob')).changedAt).toBeUndefined();
  });

  it('a verified contact: sending waits until the new code is accepted', async () => {
    const { server, alice } = await setup();
    await setVerified(alice.store, 'bob', true);
    const bob2 = await bobStartsFresh(server);
    alice.messenger.forget('bob');
    await expect(alice.send('dm', false, ['alice', 'bob'], 'secret')).rejects.toMatchObject({ code: 'identity_changed' });
    const t = await trustOf(alice.store, 'alice', 'bob');
    expect(t).toMatchObject({ verified: false, needsAccept: true });
    await acceptKeyChange(alice.store, 'bob');
    await alice.send('dm', false, ['alice', 'bob'], 'secret');
    expect(await bob2.read()).toEqual(['secret']);
  });
});
