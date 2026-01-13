
# """
# Conversation Model - Unified for both DM and Group chats
# """
# import uuid
# from sqlalchemy import String, DateTime, func, Boolean, Text, Index, ForeignKey
# from sqlalchemy.dialects.postgresql import UUID
# from sqlalchemy.orm import Mapped, mapped_column, relationship

# from app.db.base import Base


# class Conversation(Base):
#     """
#     Unified conversation model for both Direct Messages (DM) and Group chats.
    
#     For DM: kind='dm', title=None, only 2 members
#     For Group: kind='group', title='Group Name', 2+ members
#     """
#     __tablename__ = "conversations"
#     __table_args__ = (
#         Index('idx_conversation_kind', 'kind'),
#         Index('idx_conversation_updated', 'updated_at'),
#     )

#     id: Mapped[str] = mapped_column(
#         String, 
#         primary_key=True, 
#         default=lambda: str(uuid.uuid4())
#     )
    
#     # Type: "dm" or "group"
#     kind: Mapped[str] = mapped_column(String(20), index=True)
    
#     # Group-specific fields (NULL for DMs)
#     title: Mapped[str | None] = mapped_column(String(100), nullable=True)
#     description: Mapped[str | None] = mapped_column(Text, nullable=True)
#     avatar_url: Mapped[str] = mapped_column(String, default="")
    
#     # Metadata
#     created_by: Mapped[uuid.UUID | None] = mapped_column(
#         UUID(as_uuid=True), 
#         ForeignKey("users.id", ondelete="SET NULL"),
#         nullable=True
#     )
    
#     # Soft delete / Archive
#     is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    
#     # Timestamps
#     created_at: Mapped[DateTime] = mapped_column(
#         DateTime(timezone=True), 
#         server_default=func.now()
#     )
#     updated_at: Mapped[DateTime] = mapped_column(
#         DateTime(timezone=True), 
#         server_default=func.now(), 
#         onupdate=func.now()
#     )

#     # Relationships
#     members = relationship(
#         "ConversationMember", 
#         back_populates="conversation", 
#         cascade="all, delete-orphan"
#     )
#     messages = relationship(
#         "Message",
#         back_populates="conversation",
#         cascade="all, delete-orphan",
#         order_by="Message.created_at"
#     )

#     def __repr__(self):
#         return f"<Conversation(id={self.id}, kind={self.kind}, title={self.title})>"


# backend/app/models/conversation.py - FIX ID TYPE

import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func, UUID as SQLUUID, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        Index('idx_conversation_kind', 'kind'),
        Index('idx_conversation_updated', 'updated_at'),
    )

    # ✅ FIX: UUID not String
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    
    kind: Mapped[str] = mapped_column(String(10), index=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    avatar_url: Mapped[str] = mapped_column(String(500), default='')
    
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now()
    )
    
    members = relationship("ConversationMember", back_populates="conversation", cascade="all, delete-orphan")