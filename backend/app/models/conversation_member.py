

# import uuid
# from sqlalchemy import String, Boolean, ForeignKey, UniqueConstraint, DateTime, func, Index, Enum as SQLEnum
# from sqlalchemy.dialects.postgresql import UUID
# from sqlalchemy.orm import Mapped, mapped_column, relationship
# import enum

# from app.db.base import Base


# class MemberRole(str, enum.Enum):
#     """Member roles in a conversation"""
#     ADMIN = "admin"           # Full control: add/remove members, change settings, delete group
#     MODERATOR = "moderator"   # Can add/remove members (except admins), manage messages
#     MEMBER = "member"         # Regular member: send messages, view history
#     VIEWER = "viewer"         # Read-only: can view but not send (for announcement groups)


# class ConversationMember(Base):
#     """
#     Junction table linking users to conversations.
#     Tracks membership, permissions, and read status.
#     """
#     __tablename__ = "conversation_members"
#     __table_args__ = (
#         UniqueConstraint("conversation_id", "user_id", name="uq_conversation_user"),
#         Index('idx_member_conversation', 'conversation_id'),
#         Index('idx_member_user', 'user_id'),
#     )

#     id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
#     # Foreign Keys
#     conversation_id: Mapped[str] = mapped_column(
#         String, 
#         ForeignKey("conversations.id", ondelete="CASCADE"), 
#         index=True
#     )
    
#     user_id: Mapped[uuid.UUID] = mapped_column(
#         UUID(as_uuid=True), 
#         ForeignKey("users.id", ondelete="CASCADE"), 
#         index=True
#     )
    
#     # Role with enum
#     role: Mapped[MemberRole] = mapped_column(
#         SQLEnum(MemberRole, name="member_role_enum"),
#         default=MemberRole.MEMBER
#     )
    
#     # Permissions (can override role-based defaults)
#     can_send_messages: Mapped[bool] = mapped_column(Boolean, default=True)
    
#     # Read tracking
#     last_read_message_id: Mapped[str | None] = mapped_column(
#         String,
#         ForeignKey("messages.id", ondelete="SET NULL"),
#         nullable=True
#     )
#     last_read_at: Mapped[DateTime | None] = mapped_column(
#         DateTime(timezone=True),
#         nullable=True
#     )
    
#     # Notification preferences
#     muted: Mapped[bool] = mapped_column(Boolean, default=False)
    
#     # Timestamps
#     joined_at: Mapped[DateTime] = mapped_column(
#         DateTime(timezone=True), 
#         server_default=func.now()
#     )
    
#     # Relationships
#     conversation = relationship("Conversation", back_populates="members")
#     user = relationship("User")

#     def __repr__(self):
#         return f"<ConversationMember(conversation_id={self.conversation_id}, user_id={self.user_id}, role={self.role})>"
    
#     # Helper methods for permission checking
#     def can_add_members(self) -> bool:
#         """Check if member can add new members"""
#         return self.role in [MemberRole.ADMIN, MemberRole.MODERATOR]
    
#     def can_remove_members(self) -> bool:
#         """Check if member can remove other members"""
#         return self.role in [MemberRole.ADMIN, MemberRole.MODERATOR]
    
#     def can_change_settings(self) -> bool:
#         """Check if member can change group settings"""
#         return self.role == MemberRole.ADMIN
    
#     def can_delete_group(self) -> bool:
#         """Check if member can delete the group"""
#         return self.role == MemberRole.ADMIN

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