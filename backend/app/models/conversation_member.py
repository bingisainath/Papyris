# from sqlalchemy import String, Boolean, ForeignKey, UniqueConstraint
# from sqlalchemy.orm import Mapped, mapped_column, relationship
# from app.db.base import Base

# class ConversationMember(Base):
#     __tablename__ = "conversation_members"
#     __table_args__ = (UniqueConstraint("conversation_id", "user_id"),)

#     id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
#     conversation_id: Mapped[str] = mapped_column(String, ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
#     user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)

#     is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

#     conversation = relationship("Conversation", back_populates="members")


from sqlalchemy import String, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
import uuid

class ConversationMember(Base):
    __tablename__ = "conversation_members"
    __table_args__ = (UniqueConstraint("conversation_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(String, ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    
    # FIX: Change from String to UUID
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    
    conversation = relationship("Conversation", back_populates="members")