# import uuid
# from sqlalchemy import String, DateTime, ForeignKey, func
# from sqlalchemy.orm import Mapped, mapped_column
# from app.db.base import Base

# class Message(Base):
#     __tablename__ = "messages"

#     id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
#     conversation_id: Mapped[str] = mapped_column(String, ForeignKey("conversations.id", ondelete="CASCADE"), index=True)

#     sender_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)

#     text: Mapped[str] = mapped_column(String, default="")
#     image_url: Mapped[str] = mapped_column(String, default="")
#     video_url: Mapped[str] = mapped_column(String, default="")

#     created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index('idx_conversation_created', 'conversation_id', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(String, ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    
    # FIX: Change from String to UUID
    sender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    
    text: Mapped[str] = mapped_column(Text, nullable=False)
    media_url: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="sent")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)