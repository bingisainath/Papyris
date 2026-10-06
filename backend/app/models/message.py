# backend/app/models/message.py

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
    # Pixel size of images/videos, so clients can reserve space before loading
    media_width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    media_height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    reply_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True
    )
    
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)

    # Set on the chat card posted when an expense is added
    expense_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("expenses.id", ondelete="SET NULL"), nullable=True
    )
    
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