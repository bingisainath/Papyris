# backend/app/models/expense.py

"""
Expenses, who paid, who owes, settlements and the edit history.

Money is always an integer number of minor units (cents, paise...) plus an ISO 4217
currency code; see app/services/money.py. Never use floats for money.
"""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ConversationSettings(Base):
    """Per-chat expense settings."""
    __tablename__ = "conversation_settings"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True
    )
    default_currency: Mapped[str] = mapped_column(String(3), default="EUR")
    simplify_debts: Mapped[bool] = mapped_column(Boolean, default=True)
    # Receipt-scanning model for this chat (None = each user's preference / app default)
    receipt_model_id: Mapped[int | None] = mapped_column(ForeignKey("ai_models.id", ondelete="SET NULL"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (Index("idx_expense_conversation_spent", "conversation_id", "spent_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    description: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(30), default="other")
    currency: Mapped[str] = mapped_column(String(3))
    total_minor: Mapped[int] = mapped_column(BigInteger)
    # manual | receipt
    source: Mapped[str] = mapped_column(String(10), default="manual")
    # equal | exact | percent | shares | itemized (receipt)
    split_mode: Mapped[str] = mapped_column(String(10), default="equal")
    receipt_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("receipts.id", ondelete="SET NULL"), nullable=True
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    spent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    locked: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Bumped on every change; clients send it back so concurrent edits don't overwrite each other
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    payers = relationship("ExpensePayer", cascade="all, delete-orphan", lazy="selectin")
    shares = relationship("ExpenseShare", cascade="all, delete-orphan", lazy="selectin")


class ExpensePayer(Base):
    """Who paid how much. Sums to the expense total."""
    __tablename__ = "expense_payers"

    expense_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("expenses.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    amount_minor: Mapped[int] = mapped_column(BigInteger)


class ExpenseShare(Base):
    """Who owes how much. Sums to the expense total."""
    __tablename__ = "expense_shares"

    expense_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("expenses.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    # Input used for exact/percent/shares splits (e.g. 25 for 25%, 2 for 2 shares)
    split_value: Mapped[str | None] = mapped_column(String(20), nullable=True)


class ExpenseEvent(Base):
    """Audit history: who created / edited / deleted / restored / locked an expense."""
    __tablename__ = "expense_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    expense_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("expenses.id", ondelete="CASCADE"), index=True
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # created | updated | deleted | restored | locked | unlocked
    action: Mapped[str] = mapped_column(String(20))
    summary: Mapped[str] = mapped_column(Text, default="")
    before: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Settlement(Base):
    """'A paid B back X' - reduces what A owes B."""
    __tablename__ = "settlements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    from_user: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    to_user: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    currency: Mapped[str] = mapped_column(String(3))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
