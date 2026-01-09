import uuid
from sqlalchemy import String, DateTime, func, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    kind: Mapped[str] = mapped_column(String, index=True)  # "dm" | "group"
    title: Mapped[str | None] = mapped_column(String, nullable=True)  # group name
    avatar_url: Mapped[str] = mapped_column(String, default="")       # group profile pic
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    members = relationship("ConversationMember", back_populates="conversation", cascade="all, delete-orphan")
