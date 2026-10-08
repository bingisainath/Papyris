# backend/app/services/e2e_v2.py

"""
Checks the server does on end-to-end encryption v2 data (docs/encryption-design-v2.md). They mirror
web/src/crypto/v2/identity.ts. Clients verify everything themselves; these keep malformed or
mismatched keys out of the directory so a broken client can't poison it.
"""

import base64
import binascii
import hashlib
import json
import struct
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey


class KeyCheckError(ValueError):
    pass


def key32(value: Any, what: str = "key") -> bytes:
    try:
        raw = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError, TypeError):
        raise KeyCheckError(f"{what} isn't base64")
    if len(raw) != 32:
        raise KeyCheckError(f"{what} must be 32 bytes")
    return raw


def signature(value: Any) -> bytes:
    try:
        raw = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError, TypeError):
        raise KeyCheckError("Signature isn't base64")
    if len(raw) != 64:
        raise KeyCheckError("Signature must be 64 bytes")
    return raw


def verify(public: bytes, message: bytes, sig: bytes) -> bool:
    try:
        Ed25519PublicKey.from_public_bytes(public).verify(sig, message)
        return True
    except (InvalidSignature, ValueError):
        return False


def canonical_json(value: Any) -> str:
    """Same as canonicalJson() in the apps: sorted keys, no spaces, UTF-8 as is."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def cert_bytes(user: str, device_id: int, sign_pub: bytes, dh_pub: bytes, created: int) -> bytes:
    u = user.encode()
    return b"PapyrisDeviceCert.v2" + struct.pack(">I", len(u)) + u + struct.pack(">I", device_id) + sign_pub + dh_pub + struct.pack(">Q", created)


def check_device_list(signed: dict, user: str) -> tuple[bytes, int, list[dict]]:
    """Returns (account key, version, devices) of a correctly signed list, or raises KeyCheckError."""
    if not isinstance(signed, dict) or signed.get("user") != user:
        raise KeyCheckError("Device list is for someone else")
    aik = key32(signed.get("aik"), "Account key")
    version = signed.get("version")
    devices = signed.get("devices")
    if not isinstance(version, int) or version < 1 or not isinstance(devices, list) or len(devices) > 20:
        raise KeyCheckError("Malformed device list")
    unsigned = {k: v for k, v in signed.items() if k != "sig"}
    if set(unsigned) != {"user", "aik", "version", "devices"}:
        raise KeyCheckError("Malformed device list")
    if not verify(aik, ("PapyrisDeviceList.v2" + canonical_json(unsigned)).encode(), signature(signed.get("sig"))):
        raise KeyCheckError("Device list signature is invalid")
    seen = set()
    for d in devices:
        if not isinstance(d, dict) or not isinstance(d.get("id"), int) or not isinstance(d.get("created"), int) or d["id"] in seen:
            raise KeyCheckError("Malformed device in list")
        seen.add(d["id"])
        sign_pub, dh_pub = key32(d.get("sign")), key32(d.get("dh"))
        if not verify(sign_pub, dh_pub, signature(d.get("dhSig"))):
            raise KeyCheckError("A device's keys don't belong together")
        if not verify(aik, cert_bytes(user, d["id"], sign_pub, dh_pub, d["created"]), signature(d.get("cert"))):
            raise KeyCheckError("A device certificate is invalid")
    return aik, version, devices


def link_code(ek: bytes, sign_pub: bytes, dh_pub: bytes) -> str:
    """Same as linkCodeV2() in the apps."""
    return base64.b32encode(hashlib.sha256(ek + sign_pub + dh_pub).digest()).decode()[:16]
