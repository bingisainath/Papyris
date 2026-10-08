// Writes a signed device list made by the apps' code, so the server tests can check they verify it the
// same way (backend/tests/fixtures/e2e_v2_device_list.json). Run with WRITE_E2E_FIXTURE=1.
import { b64, certifyDevice, linkCodeV2, signDeviceList, sign, newX25519 } from './v2/index';
import { ed25519, x25519 } from '@noble/curves/ed25519';

const write = (globalThis as any).process?.env?.WRITE_E2E_FIXTURE;

(write ? test : test.skip)('write the cross-language fixture', () => {
  const seed = (n: number) => new Uint8Array(32).fill(n);
  const aik = { priv: seed(1), pub: ed25519.getPublicKey(seed(1)) };
  const device = { sign: { priv: seed(2), pub: ed25519.getPublicKey(seed(2)) }, dh: { priv: seed(3), pub: x25519.getPublicKey(seed(3)) } };
  const dhSig = sign(device.sign.priv, device.dh.pub);
  const cert = certifyDevice(aik.priv, 'user-é', 1, { sign: device.sign.pub, dh: device.dh.pub, dhSig }, 1760000000000);
  const list = signDeviceList(aik, 'user-é', 3, [cert]);
  const ek = x25519.getPublicKey(seed(4));
  const fs = require('fs');
  fs.writeFileSync('../backend/tests/fixtures/e2e_v2_device_list.json', JSON.stringify({
    list, link: { ek: b64(ek), code: linkCodeV2({ ek, identitySign: device.sign.pub, identityDh: device.dh.pub }) },
  }, null, 2));
  void newX25519;
});
