# backend/app/models/blocked_user.py

from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.db.base import Base


class BlockedUser(Base):
    __tablename__ = "blocked_users"

    # ✅ IMPORTANT: Use Integer for id, not UUID
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    blocker_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    blocked_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    blocked_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Ensure unique blocker-blocked pair
    __table_args__ = (
        UniqueConstraint('blocker_id', 'blocked_id', name='unique_blocker_blocked'),
        Index('ix_blocked_users_blocker_id', 'blocker_id'),
        Index('ix_blocked_users_blocked_id', 'blocked_id'),
    )

    # Relationships
    blocker = relationship("User", foreign_keys=[blocker_id], back_populates="blocked_users")
    blocked = relationship("User", foreign_keys=[blocked_id], back_populates="blocked_by_users")