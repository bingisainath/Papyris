"""Request bodies for the expenses routes (app/api/v1/expenses.py)."""

import uuid
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


class SplitEntry(BaseModel):
    user_id: uuid.UUID
    # exact: amount ("4.50"); percent: "25"; shares: "2"; ignored for equal
    value: Optional[str] = Field(None, max_length=20)


class PayerEntry(BaseModel):
    user_id: uuid.UUID
    amount: str = Field(..., max_length=20)


class ExpenseRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=200)
    category: str = "other"
    currency: str = Field(..., min_length=3, max_length=3)
    amount: str = Field(..., max_length=20)
    spent_at: Optional[datetime] = None
    split_mode: Literal["equal", "exact", "percent", "shares", "itemized"] = "equal"
    splits: list[SplitEntry] = Field(default_factory=list, max_length=200)
    # None = the person adding it paid everything
    payers: Optional[list[PayerEntry]] = Field(None, max_length=200)
    # Required when editing: the version you started from
    version: Optional[int] = None


class LockRequest(BaseModel):
    locked: bool


class SettlementRequest(BaseModel):
    from_user: uuid.UUID
    to_user: uuid.UUID
    currency: str = Field(..., min_length=3, max_length=3)
    amount: str = Field(..., max_length=20)
    note: Optional[str] = Field(None, max_length=200)


class SettlementUpdate(BaseModel):
    amount: str = Field(..., max_length=20)
    note: Optional[str] = Field(None, max_length=200)


class SettingsRequest(BaseModel):
    default_currency: Optional[str] = Field(None, min_length=3, max_length=3)
    simplify_debts: Optional[bool] = None


class RemindRequest(BaseModel):
    user_id: uuid.UUID
    currency: str = Field(..., min_length=3, max_length=3)
