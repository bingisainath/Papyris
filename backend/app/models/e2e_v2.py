# backend/app/models/e2e_v2.py

"""
End-to-end encryption v2 (docs/encryption-design-v2.md): per-device identities, prekeys, the
account's signed device list, device linking and per-device mailboxes.

The server stores public keys, signed lists and ciphertext only. Clients verify every signature
themselves (against the account key they pinned); the server's own checks just keep junk out.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class E2EDevice(Base):
    """One phone or browser of an account, with its own identity keys."""

    __tablename__ = "e2e_devices"
    __table_args__ = (UniqueConstraint("user_id", "device_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    device_id: Mapped[int] = mapped_column(Integer)  # 1, 2, 3... per account, never reused
    name: Mapped[str] = mapped_column(String(100))
    sign_public: Mapped[str] = mapped_column(String(64))  # Ed25519
    dh_public: Mapped[str] = mapped_column(String(64))  # X25519
    dh_signature: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Encrypted message history sent when it was linked; deleted once the device has downloaded it
    history_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # The sign-in that registered it: logging the device out also ends that sign-in
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class E2EDeviceList(Base):
    """The account's device list, signed by its account identity key (held by every linked device)."""

    __tablename__ = "e2e_device_lists"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    aik: Mapped[str] = mapped_column(String(64))  # account identity key (Ed25519), b64
    version: Mapped[int] = mapped_column(Integer)
    signed_list: Mapped[str] = mapped_column(Text)  # JSON exactly as signed
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class E2ESignedPreKey(Base):
    __tablename__ = "e2e_signed_prekeys"
    __table_args__ = (UniqueConstraint("user_id", "device_id", "key_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    device_id: Mapped[int] = mapped_column(Integer)
    key_id: Mapped[int] = mapped_column(Integer)
    public: Mapped[str] = mapped_column(String(64))
    signature: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class E2EOneTimePreKey(Base):
    """Handed out once (deleted when a bundle uses it)."""

    __tablename__ = "e2e_one_time_prekeys"
    __table_args__ = (UniqueConstraint("user_id", "device_id", "key_id"), Index("ix_e2e_otpk_device", "user_id", "device_id"))

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    device_id: Mapped[int] = mapped_column(Integer)
    key_id: Mapped[int] = mapped_column(Integer)
    public: Mapped[str] = mapped_column(String(64))


class E2ELinkRequest(Base):
    """A new device (already registered) waiting for the primary to certify it."""

    __tablename__ = "e2e_link_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    device_id: Mapped[int] = mapped_column(Integer)
    ephemeral_public: Mapped[str] = mapped_column(String(64))
    code: Mapped[str] = mapped_column(String(16), index=True)
    grant: Mapped[str | None] = mapped_column(Text, nullable=True)  # encrypted for the new device only
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class E2EEnvelope(Base):
    """A packet waiting for one device; deleted once that device acknowledges it."""

    __tablename__ = "e2e_envelopes"
    __table_args__ = (Index("ix_e2e_envelope_recipient", "recipient_user_id", "recipient_device_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipient_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    recipient_device_id: Mapped[int] = mapped_column(Integer)
    sender_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    sender_device_id: Mapped[int] = mapped_column(Integer)
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=True)
    message_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)  # the timeline row it belongs to
    packet: Mapped[str] = mapped_column(Text)  # JSON MessagePacket / GroupPacket, opaque
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class E2EBackup(Base):
    """
    The account's optional encrypted backup (one at a time). The blob is end-to-end encrypted with a
    random key, which is stored here wrapped with a key derived from the person's 64-digit recovery
    key. The server never sees the recovery key, so it can't open either.
    """

    __tablename__ = "e2e_backups"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    url: Mapped[str] = mapped_column(String(500))  # the encrypted blob (an upload)
    sha256: Mapped[str] = mapped_column(String(64))
    size: Mapped[int] = mapped_column(Integer)
    wrapped_key: Mapped[str] = mapped_column(Text)  # JSON {n, c}: the blob key, encrypted with the recovery key
    verifier: Mapped[str] = mapped_column(String(64))  # lets the apps tell a mistyped recovery key at once
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
