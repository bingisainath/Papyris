# """
# Message Model - Enhanced with media support and message types
# """
# import uuid
# import enum
# from datetime import datetime
# from sqlalchemy import String, Text, DateTime, ForeignKey, func, Index, Boolean, Enum as SQLEnum, Integer
# from sqlalchemy.dialects.postgresql import UUID
# from sqlalchemy.orm import Mapped, mapped_column, relationship

# from app.db.base import Base


# class MessageType(str, enum.Enum):
#     """Types of messages supported"""
#     TEXT = "text"
#     IMAGE = "image"
#     VIDEO = "video"
#     FILE = "file"
#     AUDIO = "audio"
#     SYSTEM = "system"  # For "User joined", "User left", etc.


# class Message(Base):
#     """
#     Message model supporting text, media, and system messages.
#     Enhanced with proper media metadata tracking.
#     """
#     __tablename__ = "messages"
#     __table_args__ = (
#         Index('idx_conversation_created', 'conversation_id', 'created_at'),
#         Index('idx_message_sender', 'sender_id'),
#     )

#     id: Mapped[str] = mapped_column(
#         String, 
#         primary_key=True, 
#         default=lambda: str(uuid.uuid4())
#     )
    
#     # Foreign Keys
#     conversation_id: Mapped[str] = mapped_column(
#         String, 
#         ForeignKey("conversations.id", ondelete="CASCADE"), 
#         index=True
#     )
    
#     sender_id: Mapped[uuid.UUID] = mapped_column(
#         UUID(as_uuid=True), 
#         ForeignKey("users.id", ondelete="CASCADE")
#     )
    
#     # Content
#     text: Mapped[str] = mapped_column(Text, nullable=False)
#     message_type: Mapped[MessageType] = mapped_column(
#         SQLEnum(MessageType, name="message_type_enum"), 
#         default=MessageType.TEXT
#     )
    
#     # Media fields (for images, videos, files)
#     media_url: Mapped[str | None] = mapped_column(String, nullable=True)
#     media_thumbnail: Mapped[str | None] = mapped_column(String, nullable=True)
#     media_size: Mapped[int | None] = mapped_column(Integer, nullable=True)  # in bytes
#     media_filename: Mapped[str | None] = mapped_column(String, nullable=True)
    
#     # Reply/Thread support (for future)
#     reply_to_id: Mapped[str | None] = mapped_column(
#         String,
#         ForeignKey("messages.id", ondelete="SET NULL"),
#         nullable=True
#     )
    
#     # Status for sender (sent/delivered/read)
#     # Note: Per-user status is tracked in MessageReceipt table
#     status: Mapped[str] = mapped_column(String, default="sent")
    
#     # Soft delete
#     is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
#     deleted_at: Mapped[datetime | None] = mapped_column(
#         DateTime(timezone=True), 
#         nullable=True
#     )
    
#     # Timestamps
#     created_at: Mapped[datetime] = mapped_column(
#         DateTime(timezone=True), 
#         server_default=func.now(), 
#         index=True
#     )
#     updated_at: Mapped[datetime | None] = mapped_column(
#         DateTime(timezone=True),
#         onupdate=func.now(),
#         nullable=True
#     )
    
#     # Relationships
#     conversation = relationship("Conversation", back_populates="messages")
#     sender = relationship("User")
#     receipts = relationship(
#         "MessageReceipt",
#         back_populates="message",
#         cascade="all, delete-orphan"
#     )

#     def __repr__(self):
#         return f"<Message(id={self.id}, sender_id={self.sender_id}, type={self.message_type})>"

# backend/app/models/message.py - FIX TYPES

import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, func, Boolean, Integer, ForeignKey, Index, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.base import Base


class MessageType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    FILE = "file"
    AUDIO = "audio"
    SYSTEM = "system"


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index('idx_message_conversation', 'conversation_id'),
        Index('idx_message_sender', 'sender_id'),
        Index('idx_message_created', 'created_at'),
    )

    # ✅ FIX: All IDs should be UUID
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        index=True
    )
    
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True
    )
    
    message_type: Mapped[MessageType] = mapped_column(
        SQLEnum(MessageType, name="message_type_enum"),
        default=MessageType.TEXT
    )
    
    text: Mapped[str] = mapped_column(Text, default='')
    
    media_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    media_thumbnail: Mapped[str | None] = mapped_column(String(500), nullable=True)
    media_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    media_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    reply_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True
    )
    
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(),
        index=True
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    
    sender = relationship("User")
    conversation = relationship("Conversation")