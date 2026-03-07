# # backend/app/models/message.py

# import uuid
# from datetime import datetime
# from sqlalchemy import String, Text, DateTime, func, Boolean, Integer, ForeignKey, Index, Enum as SQLEnum
# from sqlalchemy.dialects.postgresql import UUID
# from sqlalchemy.orm import Mapped, mapped_column, relationship
# import enum

# from app.db.base import Base


# class MessageType(str, enum.Enum):
#     TEXT = "text"
#     IMAGE = "image"
#     VIDEO = "video"
#     FILE = "file"
#     AUDIO = "audio"
#     SYSTEM = "system"


# class Message(Base):
#     __tablename__ = "messages"
#     __table_args__ = (
#         Index('idx_message_conversation', 'conversation_id'),
#         Index('idx_message_sender', 'sender_id'),
#         Index('idx_message_created', 'created_at'),
#     )

#     id: Mapped[uuid.UUID] = mapped_column(
#         UUID(as_uuid=True), 
#         primary_key=True, 
#         default=uuid.uuid4
#     )
    
#     conversation_id: Mapped[uuid.UUID] = mapped_column(
#         UUID(as_uuid=True),
#         ForeignKey("conversations.id", ondelete="CASCADE"),
#         index=True
#     )
    
#     sender_id: Mapped[uuid.UUID] = mapped_column(
#         UUID(as_uuid=True),
#         ForeignKey("users.id", ondelete="CASCADE"),
#         index=True
#     )
    
#     message_type: Mapped[MessageType] = mapped_column(
#         SQLEnum(MessageType, name="message_type_enum"),
#         default=MessageType.TEXT
#     )
    
#     text: Mapped[str] = mapped_column(Text, default='')
    
#     media_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
#     media_thumbnail: Mapped[str | None] = mapped_column(String(500), nullable=True)
#     media_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
#     media_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
#     reply_to_id: Mapped[uuid.UUID | None] = mapped_column(
#         UUID(as_uuid=True),
#         ForeignKey("messages.id", ondelete="SET NULL"),
#         nullable=True
#     )
    
#     is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    
#     created_at: Mapped[datetime] = mapped_column(
#         DateTime(timezone=True), 
#         server_default=func.now(),
#         index=True
#     )
#     updated_at: Mapped[datetime | None] = mapped_column(
#         DateTime(timezone=True),
#         nullable=True
#     )
    
#     sender = relationship("User")
#     conversation = relationship("Conversation")


# backend/app/models/message.py - UPDATED WITH REACTIONS

import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, func, Boolean, Integer, ForeignKey, Index, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
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
        Index('idx_message_reactions', 'reactions', postgresql_using='gin'),  # GIN index for JSONB
    )

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
    
    # ✅ REACTIONS - Store as JSONB
    # Format: {"❤️": ["user_id_1", "user_id_2"], "👍": ["user_id_3"]}
    reactions: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        default=dict,
        server_default='{}'    
    )
    
    
    
    # ✅ EDITING SUPPORT
    is_edited: Mapped[bool] = mapped_column(Boolean, default=False)
    edited_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(),
        index=True
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        onupdate=func.now()
    )
    
    sender = relationship("User")
    conversation = relationship("Conversation")
    reply_to = relationship("Message", remote_side=[id], backref="replies")


# Helper functions for reactions (can go in utils or services)

def add_reaction(message: Message, emoji: str, user_id: str) -> dict:
    """Add or remove a reaction from a message"""
    if message.reactions is None:
        message.reactions = {}
    
    # Convert UUID to string for JSON storage
    user_id_str = str(user_id)
    
    if emoji in message.reactions:
        if user_id_str in message.reactions[emoji]:
            # Remove reaction
            message.reactions[emoji].remove(user_id_str)
            if not message.reactions[emoji]:  # Remove emoji if no users left
                del message.reactions[emoji]
            action = "removed"
        else:
            # Add reaction
            message.reactions[emoji].append(user_id_str)
            action = "added"
    else:
        # New emoji reaction
        message.reactions[emoji] = [user_id_str]
        action = "added"
    
    # Mark as modified for SQLAlchemy to detect change
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(message, "reactions")
    
    return {"action": action, "reactions": format_reactions(message.reactions)}


def format_reactions(reactions_dict: dict | None) -> list:
    """
    Convert reactions dict to frontend format
    Input: {"❤️": ["user1", "user2"], "👍": ["user3"]}
    Output: [{"emoji": "❤️", "users": ["user1", "user2"], "count": 2}, ...]
    """
    if not reactions_dict:
        return []
    
    return [
        {
            "emoji": emoji,
            "users": users,
            "count": len(users)
        }
        for emoji, users in reactions_dict.items()
    ]