// Phase 5: linking devices (QR or code), moving the history, starting fresh, restoring the account key.

import {
  adoptAccountKey, approveDeviceLink, decryptMedia, encryptMedia, exportHistory, findLinkByCode, findLinkByQr, importHistory,
  startDeviceLink, startFreshAccount, waitForGrant,
} from './index';
import type { GrantPayload } from './index';
import { Device, Server } from './testing';

const blobs = new Map<string, Uint8Array>();

/** What the apps do on the approving device: encrypt the history, "upload" it, approve. */
async function approve(approver: Device, found: Parameters<typeof approveDeviceLink>[3], v1?: GrantPayload['v1']) {
  const { bytes, count } = await exportHistory(approver.store, approver.user);
  const sealed = encryptMedia(bytes);
  const url = `/media/${blobs.size + 1}.enc`;
  blobs.set(url, sealed.blob);
  return approveDeviceLink(approver.store, approver.server.http(approver.user), approver.user, found,
    { history: { url, key: sealed.key, sha256: sealed.sha256, size: sealed.size, count }, v1 });
}

/** What the apps do on the new device: show the code, wait, then import the history. */
async function linkNew(device: Device, approver: Device, by: 'qr' | 'code' = 'qr') {
  const http = device.server.http(device.user);
  const pending = await startDeviceLink(device.store, http);
  const found = by === 'qr'
    ? await findLinkByQr(approver.server.http(approver.user), pending.qrText)
    : await findLinkByCode(approver.server.http(approver.user), pending.code);
  await approve(approver, found!, { secret: 'v1-secret', encPublic: 'v1-pub' });
  const grant = (await waitForGrant(device.store, http, device.user, pending, () => false, 1))!;
  const imported = await importHistory(device.store, device.user, decryptMedia(blobs.get(grant.history!.url)!, grant.history!));
  await device.start();
  approver.messenger.forget(device.user);
  return { grant, imported };
}

async function setup() {
  const server = new Server();
  const phone = await new Device(server, 'alice', 'Alice phone').start(); // first device: holds the account key
  const bob = await new Device(server, 'bob', 'Bob phone').start();
  await bob.send('dm', false, ['alice', 'bob'], 'before the laptop');
  expect(await phone.read()).toEqual(['before the laptop']);
  return { server, phone, bob };
}

describe('linking a device', () => {
  it('adds it to the signed list, hands over keys and history, and it then receives new messages', async () => {
    const { server, phone, bob } = await setup();
    const laptop = await new Device(server, 'alice', 'Alice laptop').start();
    expect(await laptop.messenger.ready(['alice', 'bob'])).toBe(false); // registered, not on the list yet

    const { grant, imported } = await linkNew(laptop, phone);
    expect(grant.v1).toEqual({ secret: 'v1-secret', encPublic: 'v1-pub' });
    expect(imported).toBe(1);
    expect((await laptop.store.messages('dm')).map((m) => m.text)).toEqual(['before the laptop']);
    expect(server.lists.get('alice')!.devices.map((d) => d.id)).toEqual([1, 2]);
    expect(server.links.size).toBe(0); // the grant was handed over once and deleted
    expect((await laptop.store.pin('bob'))!.aik).toBe((await phone.store.pin('bob'))!.aik);

    bob.messenger.forget('alice');
    await bob.send('dm', false, ['alice', 'bob'], 'after');
    expect(await laptop.read()).toEqual(['after']);
    expect(await phone.read()).toEqual(['after']);
    expect(await laptop.messenger.ready(['alice', 'bob'])).toBe(true);
    await laptop.send('dm', false, ['alice', 'bob'], 'from the laptop');
    expect(await bob.read()).toEqual(['from the laptop']);
  });

  it('any linked device can link the next one, by typed code too', async () => {
    const { server, phone } = await setup();
    const laptop = await new Device(server, 'alice', 'Alice laptop').start();
    await linkNew(laptop, phone);
    const tablet = await new Device(server, 'alice', 'Alice tablet').start();
    await linkNew(tablet, laptop, 'code');
    expect(server.lists.get('alice')!.devices.map((d) => d.id)).toEqual([1, 2, 3]);
    expect(server.lists.get('alice')!.version).toBe(3);
  });

  it('refuses a QR whose keys differ from the server copy, and a code nobody is waiting with', async () => {
    const { server, phone } = await setup();
    const laptop = await new Device(server, 'alice', 'Alice laptop').start();
    const pending = await startDeviceLink(laptop.store, server.http('alice'));
    const other = await new Device(server, 'alice', 'Attacker').start();
    const swapped = await startDeviceLink(other.store, server.http('alice'));
    // The server answers the laptop's request id with the attacker's keys
    server.links.get(pending.request.id)!.ek = swapped.request.ek;
    await expect(findLinkByQr(server.http('alice'), pending.qrText)).rejects.toThrow("doesn't match");
    expect(await findLinkByQr(server.http('alice'), 'papyris-link:abc')).toBeNull(); // a version 1 code
    expect(await findLinkByCode(server.http('alice'), 'AAAA-BBBB-CCCC-DDDD')).toBeNull();
    expect(server.lists.get('alice')!.devices.map((d) => d.id)).toEqual([1]);
    void phone;
  });

  it('logging out takes the device off the list', async () => {
    const { server, phone } = await setup();
    const laptop = await new Device(server, 'alice', 'Alice laptop').start();
    await linkNew(laptop, phone);
    await laptop.manager.logout();
    expect(server.lists.get('alice')!.devices.map((d) => d.id)).toEqual([1]);
    await phone.manager.logout(); // the last device keeps the list, so contacts keep the account key
    expect(server.lists.get('alice')!.devices.map((d) => d.id)).toEqual([1]);
  });
});

describe('without another device', () => {
  it('starting fresh makes a new account key; contacts notice the change', async () => {
    const { server, phone, bob } = await setup();
    const oldAik = server.lists.get('alice')!.aik;
    const laptop = await new Device(server, 'alice', 'Alice laptop').start();
    await startFreshAccount(laptop.store, server.http('alice'), 'alice');
    await laptop.start();
    const list = server.lists.get('alice')!;
    expect(list.aik).not.toBe(oldAik);
    expect(list.devices.map((d) => d.id)).toEqual([2]);
    bob.messenger.forget('alice');
    await bob.send('dm', false, ['alice', 'bob'], 'new keys?');
    expect((await bob.store.pin('alice'))!.changedAt).toBeDefined();
    expect(await laptop.read()).toEqual(['new keys?']);
    void phone;
  });

  it('a restored account key keeps the security code and the other devices', async () => {
    const { server, phone } = await setup();
    const aik = (await phone.store.accountKey())!;
    const laptop = await new Device(server, 'alice', 'Alice laptop').start();
    await adoptAccountKey(laptop.store, server.http('alice'), 'alice', aik);
    const list = server.lists.get('alice')!;
    expect(list.devices.map((d) => d.id)).toEqual([1, 2]);
    expect(list.aik).toBe((await phone.store.pin('alice'))?.aik ?? list.aik);
    await expect(adoptAccountKey(laptop.store, server.http('alice'), 'alice', { ...aik, pub: new Uint8Array(32) })).rejects.toThrow('damaged');
  });
});
