# backend/app/models/e2e_key.py

"""
End-to-end encryption keys (see web/src/crypto/e2e.ts for the scheme).

The server only ever holds public keys, so it can't read encrypted messages or files. The private
keys are created on the first device and copied to more devices by linking (KeyLinkRequest): the new
device shows a QR code, a signed-in device scans it and sends the keys encrypted for that device only.
Replaced keys are kept (public halves only) so signatures on older messages can still be checked.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserKeys(Base):
    __tablename__ = "user_keys"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    enc_public: Mapped[str] = mapped_column(String(64))  # X25519, base64
    sign_public: Mapped[str] = mapped_column(String(64))  # Ed25519, base64
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PreviousUserKeys(Base):
    __tablename__ = "previous_user_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    enc_public: Mapped[str] = mapped_column(String(64))
    sign_public: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    replaced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class KeyLinkRequest(Base):
    """A new device asking one of the account's signed-in devices for the keys (expires in minutes)."""

    __tablename__ = "key_link_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    ephemeral_public: Mapped[str] = mapped_column(String(64))  # the new device's one-off X25519 key
    code: Mapped[str] = mapped_column(String(16), index=True)  # fingerprint of that key, typed instead of scanning
    device_name: Mapped[str] = mapped_column(String(100))
    payload: Mapped[str | None] = mapped_column(Text, nullable=True)  # the keys, encrypted for the new device
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
