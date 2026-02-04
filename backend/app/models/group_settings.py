# backend/app/models/group_settings.py

from sqlalchemy import Column, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.db.base import Base


class GroupSettings(Base):
    __tablename__ = "group_settings"

    # ✅ IMPORTANT: Use Integer for id, not UUID
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )
    
    only_admins_can_message = Column(Boolean, default=False, nullable=False)
    only_admins_can_add_members = Column(Boolean, default=True, nullable=False)
    send_message_notification = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationship
    conversation = relationship("Conversation", back_populates="settings")