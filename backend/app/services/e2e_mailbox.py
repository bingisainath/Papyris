# backend/app/services/e2e_mailbox.py

"""
Queuing end-to-end encryption v2 packets for devices (used by the REST endpoint and the WebSocket).
The packets are opaque; this only checks who may send what to whom.
"""

import json
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.e2e_v2 import E2EDevice, E2EEnvelope
from app.services.message_service import MessageService

MAX_PACKET_BYTES = 256 * 1024
MAX_PACKETS_PER_SEND = 200


class MailboxError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


@dataclass
class Outgoing:
    to_user: uuid.UUID
    to_device: int
    packet: dict[str, Any]


async def queue(db: AsyncSession, sender_id: uuid.UUID, conversation_id: uuid.UUID, from_device: int,
                packets: list[Outgoing], message_id: uuid.UUID | None) -> list[E2EEnvelope]:
    """Add the packets to the devices' mailboxes (not committed). Raises MailboxError."""
    if not packets or len(packets) > MAX_PACKETS_PER_SEND:
        raise MailboxError(422, "Nothing to send, or too many packets")
    sender_device = (await db.execute(select(E2EDevice.id).where(
        E2EDevice.user_id == sender_id, E2EDevice.device_id == from_device, E2EDevice.removed_at.is_(None),
    ))).scalar_one_or_none()
    if sender_device is None:
        raise MailboxError(404, "Device not found")
    members = {uuid.UUID(m) for m in await MessageService.member_ids(db, conversation_id)}
    if sender_id not in members:
        raise MailboxError(404, "Conversation not found")
    targets = {(p.to_user, p.to_device) for p in packets}
    if any(u not in members for u, _ in targets):
        raise MailboxError(422, "Packets can only go to members of this conversation")
    active = set((await db.execute(select(E2EDevice.user_id, E2EDevice.device_id).where(
        E2EDevice.user_id.in_({u for u, _ in targets}), E2EDevice.removed_at.is_(None),
    ))).all())
    if not targets <= active:
        raise MailboxError(409, "Some devices were removed. Fetch the device lists again.")
    rows = []
    for p in packets:
        raw = json.dumps(p.packet)
        if len(raw) > MAX_PACKET_BYTES:
            raise MailboxError(413, "Packet too large")
        rows.append(E2EEnvelope(
            recipient_user_id=p.to_user, recipient_device_id=p.to_device, sender_user_id=sender_id,
            sender_device_id=from_device, conversation_id=conversation_id, message_id=message_id, packet=raw,
        ))
    db.add_all(rows)
    await db.flush()
    return rows


def envelope_view(e: E2EEnvelope) -> dict:
    return {"id": str(e.id), "from": {"user": str(e.sender_user_id), "device": e.sender_device_id},
            "conversation_id": str(e.conversation_id) if e.conversation_id else None,
            "message_id": str(e.message_id) if e.message_id else None,
            "packet": json.loads(e.packet), "created_at": e.created_at.isoformat() if e.created_at else None}


def events(rows: list[E2EEnvelope]) -> list[tuple[str, dict]]:
    """(recipient user id, WebSocket event) for each queued packet."""
    return [(str(e.recipient_user_id), {"type": "e2e_envelope", "deviceId": e.recipient_device_id, "envelope": envelope_view(e)}) for e in rows]
