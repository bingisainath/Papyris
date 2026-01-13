# # backend/app/models/message_receipt.py

# import uuid
# from datetime import datetime
# from sqlalchemy import String, DateTime, ForeignKey, func, UniqueConstraint, Index
# from sqlalchemy.dialects.postgresql import UUID
# from sqlalchemy.orm import Mapped, mapped_column
# from app.db.base import Base


# class MessageReceipt(Base):
#     """
#     Tracks message delivery and read status for each user.
#     One receipt per (message, user) pair.
#     """
#     __tablename__ = "message_receipts"
#     __table_args__ = (
#         UniqueConstraint("message_id", "user_id", name="uq_message_user_receipt"),
#         Index('idx_message_receipt_message', 'message_id'),
#         Index('idx_message_receipt_user', 'user_id'),
#     )

#     id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
#     # Foreign key to messages table
#     message_id: Mapped[str] = mapped_column(
#         String, 
#         ForeignKey("messages.id", ondelete="CASCADE"), 
#         nullable=False
#     )
    
#     # Foreign key to users table - using UUID
#     user_id: Mapped[uuid.UUID] = mapped_column(
#         UUID(as_uuid=True), 
#         ForeignKey("users.id", ondelete="CASCADE"), 
#         nullable=False
#     )
    
#     # Status: 'delivered' | 'read'
#     status: Mapped[str] = mapped_column(String(20), default="delivered")
    
#     # When delivered
#     delivered_at: Mapped[datetime] = mapped_column(
#         DateTime(timezone=True), 
#         server_default=func.now(),
#         nullable=False
#     )
    
#     # When read (nullable)
#     read_at: Mapped[datetime | None] = mapped_column(
#         DateTime(timezone=True), 
#         nullable=True
#     )
    
#     created_at: Mapped[datetime] = mapped_column(
#         DateTime(timezone=True), 
#         server_default=func.now(),
#         nullable=False
#     )



# backend/app/models/message_receipt.py - FIX TYPES

import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func, ForeignKey, Index, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.base import Base


class ReceiptStatus(str, enum.Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"


class MessageReceipt(Base):
    __tablename__ = "message_receipts"
    __table_args__ = (
        UniqueConstraint("message_id", "user_id", name="uq_message_user_receipt"),
        Index('idx_receipt_message', 'message_id'),
        Index('idx_receipt_user', 'user_id'),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # ✅ FIX: UUID not String
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="CASCADE"),
        index=True
    )
    
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True
    )
    
    status: Mapped[ReceiptStatus] = mapped_column(
        SQLEnum(ReceiptStatus, name="receipt_status_enum"),
        default=ReceiptStatus.SENT
    )
    
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    
    message = relationship("Message")
    user = relationship("User")