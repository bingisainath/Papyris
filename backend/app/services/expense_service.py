# backend/app/services/expense_service.py

"""
Shared logic for expenses: who may do what, saving payers/shares, the edit history,
the chat card and the WebSocket notification.

Permissions:
- any member can add an expense, and edit one that isn't locked
- the person who added it, or a group admin, can delete it
- group admins can lock, unlock and restore (in a DM both people count as admins)
"""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.conversation_member import ConversationMember, MemberRole
from app.models.expense import ConversationSettings, Expense, ExpenseEvent, ExpensePayer, ExpenseShare
from app.models.user import User
from app.services import media_storage
from app.services.message_service import MessageService
from app.services.money import format_minor

CATEGORIES = {
    "groceries", "food", "drinks", "transport", "travel", "rent", "utilities",
    "household", "entertainment", "shopping", "health", "gifts", "other",
}


class Access:
    def __init__(self, conversation: Conversation, member: ConversationMember):
        self.conversation = conversation
        self.member = member

    @property
    def is_admin(self) -> bool:
        return self.conversation.kind == "dm" or self.member.role == MemberRole.ADMIN


async def load_access(db: AsyncSession, conversation_id: uuid.UUID, user: User) -> Access:
    conversation = await db.get(Conversation, conversation_id)
    member = (await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user.id,
        )
    )).scalar_one_or_none()
    if conversation is None or member is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return Access(conversation, member)


async def load_expense(db: AsyncSession, expense_id: uuid.UUID, user: User) -> tuple[Expense, Access]:
    expense = await db.get(Expense, expense_id)
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    access = await load_access(db, expense.conversation_id, user)
    return expense, access


async def get_settings(db: AsyncSession, conversation_id: uuid.UUID) -> ConversationSettings:
    found = await db.get(ConversationSettings, conversation_id)
    if found is None:
        found = ConversationSettings(conversation_id=conversation_id, default_currency="EUR", simplify_debts=True)
        db.add(found)
        await db.flush()
    return found


async def member_users(db: AsyncSession, conversation_id: uuid.UUID) -> dict[str, User]:
    rows = (await db.execute(
        select(User)
        .join(ConversationMember, ConversationMember.user_id == User.id)
        .where(ConversationMember.conversation_id == conversation_id)
    )).scalars().all()
    return {str(u.id): u for u in rows}


def require_members(user_ids, members: dict[str, User], what: str = "Everyone") -> None:
    missing = [u for u in user_ids if str(u) not in members]
    if missing:
        raise HTTPException(status_code=400, detail=f"{what} must be in this chat")


def set_parties(expense: Expense, payers: dict[str, int], shares: dict[str, int], split_values: dict[str, str] | None = None) -> None:
    expense.payers = [ExpensePayer(user_id=uuid.UUID(u), amount_minor=a) for u, a in payers.items() if a]
    split_values = split_values or {}
    expense.shares = [
        ExpenseShare(user_id=uuid.UUID(u), amount_minor=a, split_value=split_values.get(u))
        for u, a in shares.items()
    ]


def snapshot(expense: Expense) -> dict:
    """What the history stores before/after each change."""
    return {
        "description": expense.description,
        "category": expense.category,
        "currency": expense.currency,
        "total_minor": expense.total_minor,
        "split_mode": expense.split_mode,
        "spent_at": expense.spent_at.isoformat() if expense.spent_at else None,
        "payers": {str(p.user_id): p.amount_minor for p in expense.payers},
        "shares": {str(s.user_id): s.amount_minor for s in expense.shares},
    }


def describe_changes(before: dict, after: dict, members: dict[str, User]) -> str:
    def name(uid):
        user = members.get(uid)
        return user.username if user else "someone"

    parts = []
    if before["description"] != after["description"]:
        parts.append(f"renamed it from '{before['description']}' to '{after['description']}'")
    if before["total_minor"] != after["total_minor"] or before["currency"] != after["currency"]:
        parts.append(
            f"changed the amount from {format_minor(before['total_minor'], before['currency'])} "
            f"to {format_minor(after['total_minor'], after['currency'])}"
        )
    if before["payers"] != after["payers"]:
        parts.append("changed who paid (" + ", ".join(
            f"{name(u)} {format_minor(a, after['currency'])}" for u, a in after["payers"].items()
        ) + ")")
    if before["shares"] != after["shares"] and before["total_minor"] == after["total_minor"]:
        parts.append("changed the split")
    if before["category"] != after["category"]:
        parts.append(f"set the category to {after['category']}")
    if before["spent_at"] != after["spent_at"]:
        parts.append("changed the date")
    return "; ".join(parts) or "saved without changes"


def record(db: AsyncSession, expense: Expense, actor: User, action: str, summary: str,
           before: dict | None = None, after: dict | None = None) -> None:
    db.add(ExpenseEvent(
        expense_id=expense.id, actor_id=actor.id, action=action, summary=summary[:2000],
        before=before, after=after, created_at=datetime.now(timezone.utc),
    ))


def serialize(expense: Expense, receipt=None) -> dict:
    return {
        "id": str(expense.id),
        "conversation_id": str(expense.conversation_id),
        "description": expense.description,
        "category": expense.category,
        "currency": expense.currency,
        "total_minor": expense.total_minor,
        "total_display": format_minor(expense.total_minor, expense.currency),
        "source": expense.source,
        "split_mode": expense.split_mode,
        "receipt_id": str(expense.receipt_id) if expense.receipt_id else None,
        "receipt_images": [media_storage.sign_url(u) for u in (receipt.image_urls if receipt else [])],
        "created_by": str(expense.created_by) if expense.created_by else None,
        "spent_at": expense.spent_at.isoformat() if expense.spent_at else None,
        "locked": expense.locked,
        "deleted": expense.deleted_at is not None,
        "version": expense.version,
        "payers": [{"user_id": str(p.user_id), "amount_minor": p.amount_minor} for p in expense.payers],
        "shares": [
            {"user_id": str(s.user_id), "amount_minor": s.amount_minor, "split_value": s.split_value}
            for s in expense.shares
        ],
        "created_at": expense.created_at.isoformat() if expense.created_at else None,
        "updated_at": expense.updated_at.isoformat() if expense.updated_at else None,
    }


async def post_card(db: AsyncSession, expense: Expense, actor: User, text: str) -> tuple[list[str], dict]:
    """Chat message shown as an expense card; returns (member ids, payload) to publish."""
    payload = await MessageService.post_system_message(db, expense.conversation_id, actor, text, expense_id=expense.id)
    member_ids = await MessageService.member_ids(db, expense.conversation_id)
    return member_ids, payload


def changed_event(expense: Expense, action: str) -> dict:
    return {
        "type": "expense_changed",
        "conversationId": str(expense.conversation_id),
        "expenseId": str(expense.id),
        "action": action,
    }
