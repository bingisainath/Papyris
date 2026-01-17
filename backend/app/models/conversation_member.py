# backend/app/models/conversation_member.py - FIX TYPE

import uuid
from sqlalchemy import Boolean, ForeignKey, UniqueConstraint, DateTime, func, Index, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.base import Base


class MemberRole(str, enum.Enum):
    ADMIN = "admin"
    MODERATOR = "moderator"
    MEMBER = "member"
    VIEWER = "viewer"


class ConversationMember(Base):
    __tablename__ = "conversation_members"
    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_conversation_user"),
        Index('idx_member_conversation', 'conversation_id'),
        Index('idx_member_user', 'user_id'),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # ✅ FIX: UUID not String
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("conversations.id", ondelete="CASCADE"), 
        index=True
    )
    
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("users.id", ondelete="CASCADE"), 
        index=True
    )
    
    role: Mapped[MemberRole] = mapped_column(
        SQLEnum(MemberRole, name="member_role_enum"),
        default=MemberRole.MEMBER
    )
    
    can_send_messages: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # ✅ FIX: UUID for message_id too
    last_read_message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True
    )
    last_read_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    
    muted: Mapped[bool] = mapped_column(Boolean, default=False)
    
    joined_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now()
    )
    
    conversation = relationship("Conversation", back_populates="members")
    user = relationship("User")