# backend/app/api/v1/e2e_v2.py

"""
End-to-end encryption v2 (docs/encryption-design-v2.md): the key directory and mailboxes.

Devices
  POST   /e2e/v2/devices                         register this phone/browser's identity keys -> device id
  GET    /e2e/v2/devices/me                      my registered devices
  DELETE /e2e/v2/devices/{device_id}             log a device out (drops its prekeys and mail)
  PUT    /e2e/v2/devices/{device_id}/prekeys     upload a signed prekey and/or one-time prekeys
  GET    /e2e/v2/devices/{device_id}/prekeys     how many one-time prekeys are left
Device lists (signed by the account key on the primary device)
  PUT    /e2e/v2/device-list                     publish a newer list
  GET    /e2e/v2/users/{user_id}/device-list     someone's list (people you share a chat with)
  GET    /e2e/v2/users/{user_id}/devices/{d}/bundle   prekeys to start a session (uses up one one-time prekey)
Linking (the new device registers first, then asks the primary to certify it)
  POST   /e2e/v2/link-requests  ·  GET /e2e/v2/link-requests?code=  ·  GET/POST /e2e/v2/link-requests/{id}[/grant]
Mailboxes (one queue per device; packets are deleted once acknowledged)
  POST   /e2e/v2/conversations/{id}/envelopes    deliver packets to devices
  GET    /e2e/v2/mailbox/{device_id}             pending packets for one of my devices
  POST   /e2e/v2/mailbox/{device_id}/ack         done with these
"""

import base64
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.conversation_member import ConversationMember
from app.models.e2e_v2 import E2EDevice, E2EDeviceList, E2EEnvelope, E2ELinkRequest, E2EOneTimePreKey, E2ESignedPreKey
from app.models.user import User
from app.services import e2e_v2 as checks
from app.services.message_service import MessageService
from app.websocket.routes import publish_users

router = APIRouter(prefix="/e2e/v2", tags=["Encryption v2"])

MAX_DEVICES = 10
MAX_ONE_TIME_PREKEYS = 200
MAX_PACKET_BYTES = 256 * 1024
MAX_PACKETS_PER_SEND = 200
LINK_TTL = timedelta(minutes=10)
MAILBOX_PAGE = 200


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _bad(error: Exception):
    raise HTTPException(status_code=422, detail=str(error))


async def _partner_ids(db: AsyncSession, user_id: uuid.UUID) -> set[uuid.UUID]:
    mine = select(ConversationMember.conversation_id).where(ConversationMember.user_id == user_id)
    rows = await db.execute(select(ConversationMember.user_id).where(ConversationMember.conversation_id.in_(mine)).distinct())
    return set(rows.scalars().all()) | {user_id}


async def _my_device(db: AsyncSession, user: User, device_id: int) -> E2EDevice:
    device = (await db.execute(select(E2EDevice).where(
        E2EDevice.user_id == user.id, E2EDevice.device_id == device_id, E2EDevice.removed_at.is_(None),
    ))).scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


async def _current_list(db: AsyncSession, user_id: uuid.UUID) -> Optional[dict]:
    row = await db.get(E2EDeviceList, user_id)
    return json.loads(row.signed_list) if row else None


def _device_view(d: E2EDevice) -> dict:
    return {"device_id": d.device_id, "name": d.name, "sign": d.sign_public, "dh": d.dh_public, "dhSig": d.dh_signature,
            "created_at": d.created_at.isoformat() if d.created_at else None}


# ---- devices

class RegisterDevice(BaseModel):
    sign: str = Field(..., max_length=64)
    dh: str = Field(..., max_length=64)
    dhSig: str = Field(..., max_length=100)
    name: str = Field("Device", max_length=100)


@router.post("/devices")
async def register_device(body: RegisterDevice, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """A new phone or browser registers its identity keys and gets its device number."""
    try:
        sign_pub, dh_pub = checks.key32(body.sign), checks.key32(body.dh)
        if not checks.verify(sign_pub, dh_pub, checks.signature(body.dhSig)):
            raise checks.KeyCheckError("The device's keys don't belong together")
    except checks.KeyCheckError as e:
        _bad(e)
    active = await db.scalar(select(func.count()).select_from(E2EDevice).where(E2EDevice.user_id == user.id, E2EDevice.removed_at.is_(None)))
    if active >= MAX_DEVICES:
        raise HTTPException(status_code=409, detail=f"At most {MAX_DEVICES} devices. Log out of one first.")
    # Lock this user's device rows so two registrations can't get the same number
    await db.execute(select(E2EDevice.id).where(E2EDevice.user_id == user.id).with_for_update())
    highest = await db.scalar(select(func.max(E2EDevice.device_id)).where(E2EDevice.user_id == user.id)) or 0
    device = E2EDevice(user_id=user.id, device_id=highest + 1, name=body.name.strip() or "Device",
                       sign_public=body.sign, dh_public=body.dh, dh_signature=body.dhSig)
    db.add(device)
    await db.commit()
    return {"success": True, "data": _device_view(device)}


@router.get("/devices/me")
async def my_devices(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(E2EDevice).where(E2EDevice.user_id == user.id, E2EDevice.removed_at.is_(None)).order_by(E2EDevice.device_id))).scalars().all()
    return {"success": True, "data": {"devices": [_device_view(d) for d in rows], "device_list": await _current_list(db, user.id)}}


@router.delete("/devices/{device_id}")
async def remove_device(device_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Log a device out. The primary also publishes a new device list without it."""
    device = await _my_device(db, user, device_id)
    device.removed_at = _now()
    for model in (E2ESignedPreKey, E2EOneTimePreKey):
        await db.execute(delete(model).where(model.user_id == user.id, model.device_id == device_id))
    await db.execute(delete(E2EEnvelope).where(E2EEnvelope.recipient_user_id == user.id, E2EEnvelope.recipient_device_id == device_id))
    await db.commit()
    return {"success": True}


class PreKeyUpload(BaseModel):
    signedPreKey: Optional[dict[str, Any]] = None  # {id, pub, sig}
    oneTimePreKeys: list[dict[str, Any]] = Field(default_factory=list, max_length=MAX_ONE_TIME_PREKEYS)  # [{id, pub}]


@router.put("/devices/{device_id}/prekeys")
async def upload_prekeys(device_id: int, body: PreKeyUpload, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    device = await _my_device(db, user, device_id)
    try:
        if body.signedPreKey is not None:
            spk = body.signedPreKey
            if not isinstance(spk.get("id"), int):
                raise checks.KeyCheckError("Signed prekey needs an id")
            if not checks.verify(checks.key32(device.sign_public), checks.key32(spk.get("pub"), "Signed prekey"), checks.signature(spk.get("sig"))):
                raise checks.KeyCheckError("Signed prekey signature is invalid")
        for k in body.oneTimePreKeys:
            if not isinstance(k.get("id"), int):
                raise checks.KeyCheckError("One-time prekey needs an id")
            checks.key32(k.get("pub"), "One-time prekey")
    except checks.KeyCheckError as e:
        _bad(e)

    if body.signedPreKey is not None:
        existing = (await db.execute(select(E2ESignedPreKey).where(
            E2ESignedPreKey.user_id == user.id, E2ESignedPreKey.device_id == device_id, E2ESignedPreKey.key_id == body.signedPreKey["id"],
        ))).scalar_one_or_none()
        if existing is None:
            db.add(E2ESignedPreKey(user_id=user.id, device_id=device_id, key_id=body.signedPreKey["id"],
                                   public=body.signedPreKey["pub"], signature=body.signedPreKey["sig"]))
    stored = await db.scalar(select(func.count()).select_from(E2EOneTimePreKey).where(
        E2EOneTimePreKey.user_id == user.id, E2EOneTimePreKey.device_id == device_id))
    if stored + len(body.oneTimePreKeys) > MAX_ONE_TIME_PREKEYS:
        raise HTTPException(status_code=409, detail="Too many one-time prekeys stored")
    known = set((await db.execute(select(E2EOneTimePreKey.key_id).where(
        E2EOneTimePreKey.user_id == user.id, E2EOneTimePreKey.device_id == device_id))).scalars().all())
    for k in body.oneTimePreKeys:
        if k["id"] not in known:
            db.add(E2EOneTimePreKey(user_id=user.id, device_id=device_id, key_id=k["id"], public=k["pub"]))
            known.add(k["id"])
    device.last_seen_at = _now()
    await db.commit()
    return await prekey_status(device_id, user, db)


@router.get("/devices/{device_id}/prekeys")
async def prekey_status(device_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _my_device(db, user, device_id)
    left = await db.scalar(select(func.count()).select_from(E2EOneTimePreKey).where(
        E2EOneTimePreKey.user_id == user.id, E2EOneTimePreKey.device_id == device_id))
    latest = (await db.execute(select(E2ESignedPreKey).where(
        E2ESignedPreKey.user_id == user.id, E2ESignedPreKey.device_id == device_id,
    ).order_by(E2ESignedPreKey.created_at.desc()).limit(1))).scalar_one_or_none()
    return {"success": True, "data": {
        "one_time_left": left,
        "signed_prekey": {"id": latest.key_id, "created_at": latest.created_at.isoformat()} if latest else None,
    }}


# ---- device lists

class PublishList(BaseModel):
    device_list: dict[str, Any]
    # True only for a fresh start (a new account key; contacts will see "security code changed")
    replace: bool = False


@router.put("/device-list")
async def publish_device_list(body: PublishList, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        aik, version, devices = checks.check_device_list(body.device_list, str(user.id))
    except checks.KeyCheckError as e:
        _bad(e)
    current = await db.get(E2EDeviceList, user.id)
    aik_b64 = base64.b64encode(aik).decode()
    if current is not None:
        if current.aik != aik_b64 and not body.replace:
            raise HTTPException(status_code=409, detail="Signed by a different account key")
        if current.aik == aik_b64 and version <= current.version:
            raise HTTPException(status_code=409, detail="A newer device list is already published")
    # Every device on the list must be one of this account's registered, active devices, with the same keys
    registered = {d.device_id: d for d in (await db.execute(select(E2EDevice).where(
        E2EDevice.user_id == user.id, E2EDevice.removed_at.is_(None)))).scalars().all()}
    for d in devices:
        r = registered.get(d["id"])
        if r is None or r.sign_public != d["sign"] or r.dh_public != d["dh"]:
            raise HTTPException(status_code=422, detail=f"Device {d['id']} isn't registered with these keys")
    if current is None:
        db.add(E2EDeviceList(user_id=user.id, aik=aik_b64, version=version, signed_list=json.dumps(body.device_list), updated_at=_now()))
    else:
        current.aik, current.version, current.signed_list, current.updated_at = aik_b64, version, json.dumps(body.device_list), _now()
    await db.commit()
    partners = await _partner_ids(db, user.id)
    await publish_users([str(u) for u in partners], {"type": "e2e_device_list", "userId": str(user.id), "version": version})
    return {"success": True}


@router.get("/users/{user_id}/device-list")
async def device_list(user_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user_id not in await _partner_ids(db, user.id):
        raise HTTPException(status_code=404, detail="Not found")
    signed = await _current_list(db, user_id)
    if signed is None:
        raise HTTPException(status_code=404, detail="This person hasn't set up encryption v2")
    return {"success": True, "data": signed}


@router.get("/users/{user_id}/devices/{device_id}/bundle")
async def prekey_bundle(user_id: uuid.UUID, device_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Prekeys to start a session with one device. Each call uses up one one-time prekey (if any are left)."""
    if user_id not in await _partner_ids(db, user.id):
        raise HTTPException(status_code=404, detail="Not found")
    device = (await db.execute(select(E2EDevice).where(
        E2EDevice.user_id == user_id, E2EDevice.device_id == device_id, E2EDevice.removed_at.is_(None),
    ))).scalar_one_or_none()
    spk = (await db.execute(select(E2ESignedPreKey).where(
        E2ESignedPreKey.user_id == user_id, E2ESignedPreKey.device_id == device_id,
    ).order_by(E2ESignedPreKey.created_at.desc(), E2ESignedPreKey.id.desc()).limit(1))).scalar_one_or_none()
    if device is None or spk is None:
        raise HTTPException(status_code=404, detail="This device has no prekeys")
    # Take one one-time prekey; SKIP LOCKED so two senders never get the same one
    opk = (await db.execute(select(E2EOneTimePreKey).where(
        E2EOneTimePreKey.user_id == user_id, E2EOneTimePreKey.device_id == device_id,
    ).order_by(E2EOneTimePreKey.key_id).limit(1).with_for_update(skip_locked=True))).scalar_one_or_none()
    one_time = None
    if opk is not None:
        one_time = {"id": opk.key_id, "pub": opk.public}
        await db.delete(opk)
    await db.commit()
    return {"success": True, "data": {
        "user": str(user_id), "deviceId": device_id,
        "identitySign": device.sign_public, "identityDh": device.dh_public, "identityDhSig": device.dh_signature,
        "signedPreKey": {"id": spk.key_id, "pub": spk.public, "sig": spk.signature},
        "oneTimePreKey": one_time,
    }}


# ---- linking

class LinkRequestBody(BaseModel):
    device_id: int
    ek: str = Field(..., max_length=64)


def _link_view(r: E2ELinkRequest, device: E2EDevice) -> dict:
    return {"id": str(r.id), "device_id": r.device_id, "name": device.name, "ek": r.ephemeral_public,
            "sign": device.sign_public, "dh": device.dh_public, "dhSig": device.dh_signature,
            "code": r.code, "expires_at": r.expires_at.isoformat()}


@router.post("/link-requests")
async def create_link_request(body: LinkRequestBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """The new device (registered, not yet on the list) asks the primary to certify it."""
    device = await _my_device(db, user, body.device_id)
    try:
        ek = checks.key32(body.ek, "Link key")
    except checks.KeyCheckError as e:
        _bad(e)
    now = _now()
    await db.execute(delete(E2ELinkRequest).where(E2ELinkRequest.expires_at < now))
    pending = await db.scalar(select(func.count()).select_from(E2ELinkRequest).where(E2ELinkRequest.user_id == user.id))
    if pending >= 5:
        raise HTTPException(status_code=429, detail="Too many devices waiting to be linked. Try again in a few minutes.")
    code = checks.link_code(ek, checks.key32(device.sign_public), checks.key32(device.dh_public))
    request = E2ELinkRequest(user_id=user.id, device_id=device.device_id, ephemeral_public=body.ek, code=code,
                             created_at=now, expires_at=now + LINK_TTL)
    db.add(request)
    await db.commit()
    return {"success": True, "data": _link_view(request, device)}


async def _own_link(db: AsyncSession, request_id: uuid.UUID, user: User) -> tuple[E2ELinkRequest, E2EDevice]:
    request = await db.get(E2ELinkRequest, request_id)
    if request is None or request.user_id != user.id or request.expires_at < _now():
        raise HTTPException(status_code=404, detail="This link request has expired. Start again on the new device.")
    return request, await _my_device(db, user, request.device_id)


@router.get("/link-requests")
async def find_link_request(code: str = Query(..., min_length=16, max_length=32), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    clean = code.upper().replace("-", "").replace(" ", "")
    request = (await db.execute(select(E2ELinkRequest).where(
        E2ELinkRequest.user_id == user.id, E2ELinkRequest.code == clean, E2ELinkRequest.expires_at >= _now(), E2ELinkRequest.grant.is_(None),
    ))).scalars().first()
    if request is None:
        raise HTTPException(status_code=404, detail="No device is waiting with that code. Check it, or start again on the new device.")
    return {"success": True, "data": _link_view(request, await _my_device(db, user, request.device_id))}


@router.get("/link-requests/{request_id}")
async def link_request(request_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """The new device polls this; the grant is returned once and then deleted."""
    request, device = await _own_link(db, request_id, user)
    view = _link_view(request, device)
    if request.grant is None:
        return {"success": True, "data": {**view, "status": "waiting"}}
    grant = json.loads(request.grant)
    await db.delete(request)
    await db.commit()
    return {"success": True, "data": {**view, "status": "approved", "grant": grant}}


class GrantBody(BaseModel):
    grant: dict[str, Any]


@router.post("/link-requests/{request_id}/grant")
async def grant_link(request_id: uuid.UUID, body: GrantBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """The primary hands over the encrypted grant (it publishes the new device list separately)."""
    request, _ = await _own_link(db, request_id, user)
    if request.grant is not None:
        raise HTTPException(status_code=409, detail="This device has already been linked")
    if len(json.dumps(body.grant)) > 64 * 1024 or not {"v", "requestId", "e", "c"} <= body.grant.keys():
        raise HTTPException(status_code=422, detail="Invalid grant")
    request.grant = json.dumps(body.grant)
    await db.commit()
    await publish_users([str(user.id)], {"type": "e2e_link_granted", "requestId": str(request.id)})
    return {"success": True}


# ---- mailboxes

class OutgoingPacket(BaseModel):
    to_user: uuid.UUID
    to_device: int
    packet: dict[str, Any]


class SendBody(BaseModel):
    from_device: int
    packets: list[OutgoingPacket] = Field(..., min_length=1, max_length=MAX_PACKETS_PER_SEND)
    message_id: Optional[uuid.UUID] = None


async def deliver(db: AsyncSession, user: User, conversation_id: uuid.UUID, body: SendBody) -> list[str]:
    """Queue packets for devices of the conversation's members (and the sender's own devices)."""
    await _my_device(db, user, body.from_device)
    members = {uuid.UUID(m) for m in await MessageService.member_ids(db, conversation_id)}
    if user.id not in members:
        raise HTTPException(status_code=404, detail="Conversation not found")
    targets = {(p.to_user, p.to_device) for p in body.packets}
    if any(u not in members for u, _ in targets):
        raise HTTPException(status_code=422, detail="Packets can only go to members of this conversation")
    active = set((await db.execute(select(E2EDevice.user_id, E2EDevice.device_id).where(
        E2EDevice.user_id.in_({u for u, _ in targets}), E2EDevice.removed_at.is_(None),
    ))).all())
    if not targets <= active:
        raise HTTPException(status_code=409, detail="Some devices were removed. Fetch the device lists again.")
    ids = []
    for p in body.packets:
        raw = json.dumps(p.packet)
        if len(raw) > MAX_PACKET_BYTES:
            raise HTTPException(status_code=413, detail="Packet too large")
        envelope = E2EEnvelope(
            recipient_user_id=p.to_user, recipient_device_id=p.to_device, sender_user_id=user.id, sender_device_id=body.from_device,
            conversation_id=conversation_id, message_id=body.message_id, packet=raw,
        )
        db.add(envelope)
        await db.flush()
        ids.append((p.to_user, p.to_device, envelope))
    await db.commit()
    for to_user, to_device, envelope in ids:
        await publish_users([str(to_user)], {"type": "e2e_envelope", "deviceId": to_device, "envelope": _envelope_view(envelope)})
    return [str(e.id) for _, _, e in ids]


def _envelope_view(e: E2EEnvelope) -> dict:
    return {"id": str(e.id), "from": {"user": str(e.sender_user_id), "device": e.sender_device_id},
            "conversation_id": str(e.conversation_id) if e.conversation_id else None,
            "message_id": str(e.message_id) if e.message_id else None,
            "packet": json.loads(e.packet), "created_at": e.created_at.isoformat() if e.created_at else None}


@router.post("/conversations/{conversation_id}/envelopes")
async def send_envelopes(conversation_id: uuid.UUID, body: SendBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ids = await deliver(db, user, conversation_id, body)
    return {"success": True, "data": {"ids": ids}}


@router.get("/mailbox/{device_id}")
async def mailbox(device_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    device = await _my_device(db, user, device_id)
    device.last_seen_at = _now()
    rows = (await db.execute(select(E2EEnvelope).where(
        E2EEnvelope.recipient_user_id == user.id, E2EEnvelope.recipient_device_id == device_id,
    ).order_by(E2EEnvelope.created_at, E2EEnvelope.id).limit(MAILBOX_PAGE + 1))).scalars().all()
    await db.commit()
    return {"success": True, "data": [_envelope_view(e) for e in rows[:MAILBOX_PAGE]], "has_more": len(rows) > MAILBOX_PAGE}


class AckBody(BaseModel):
    ids: list[uuid.UUID] = Field(..., max_length=500)


@router.post("/mailbox/{device_id}/ack")
async def ack(device_id: int, body: AckBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _my_device(db, user, device_id)
    await db.execute(delete(E2EEnvelope).where(
        E2EEnvelope.recipient_user_id == user.id, E2EEnvelope.recipient_device_id == device_id, E2EEnvelope.id.in_(body.ids),
    ))
    await db.commit()
    return {"success": True}
