"""Request bodies for the e2e v2 routes (app/api/v1/e2e_v2.py)."""

import uuid
from typing import Any, Optional
from pydantic import BaseModel, Field
from app.services import e2e_mailbox as mailbox_service


MAX_ONE_TIME_PREKEYS = 200


MAX_PACKETS_PER_SEND = mailbox_service.MAX_PACKETS_PER_SEND


class RegisterDevice(BaseModel):
    sign: str = Field(..., max_length=64)
    dh: str = Field(..., max_length=64)
    dhSig: str = Field(..., max_length=100)
    name: str = Field("Device", max_length=100)


class PreKeyUpload(BaseModel):
    signedPreKey: Optional[dict[str, Any]] = None  # {id, pub, sig}
    oneTimePreKeys: list[dict[str, Any]] = Field(default_factory=list, max_length=MAX_ONE_TIME_PREKEYS)  # [{id, pub}]


class PublishList(BaseModel):
    device_list: dict[str, Any]
    # True only for a fresh start (a new account key; contacts will see "security code changed")
    replace: bool = False


class LinkRequestBody(BaseModel):
    device_id: int
    ek: str = Field(..., max_length=64)


class GrantBody(BaseModel):
    grant: dict[str, Any]
    # The encrypted history file (its key is inside the grant): deleted once the new device has it
    history_url: Optional[str] = Field(None, max_length=1000)


class OutgoingPacket(BaseModel):
    to_user: uuid.UUID
    to_device: int
    packet: dict[str, Any]


class SendBody(BaseModel):
    from_device: int
    packets: list[OutgoingPacket] = Field(..., min_length=1, max_length=MAX_PACKETS_PER_SEND)
    message_id: Optional[uuid.UUID] = None


class AckBody(BaseModel):
    ids: list[uuid.UUID] = Field(..., max_length=500)
