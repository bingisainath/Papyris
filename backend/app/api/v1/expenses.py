# backend/app/api/v1/expenses.py

"""
Expenses in a chat: add, edit, delete/restore, lock, history, settle up and balances.
Amounts come in as decimal strings in major units ("12.30") and are stored as integers.
"""

import logging
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.ai import AIModel
from app.models.expense import Expense, ExpenseEvent, Settlement
from app.models.receipt import Receipt
from app.models.user import User
from app.services import expense_service as svc
from app.services import media_storage
from app.services.message_service import MessageService
from app.services.balances import net_balances, pairwise, simplify
from app.services.money import CURRENCIES, MoneyError, format_minor, is_supported, to_minor
from app.services.split_engine import split_manual, validate_payers
from app.websocket.routes import publish_users

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Expenses"])


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


class SettingsRequest(BaseModel):
    default_currency: Optional[str] = Field(None, min_length=3, max_length=3)
    simplify_debts: Optional[bool] = None
    # 0 = clear (use each person's own choice)
    receipt_model_id: Optional[int] = None


def _ok(data, message: str = "OK") -> dict:
    return {"success": True, "message": message, "data": data}


def _money(value: str, currency: str, what: str = "Amount") -> int:
    try:
        return to_minor(value, currency)
    except MoneyError:
        raise HTTPException(status_code=400, detail=f"{what} isn't a valid number")


def _currency(code: str) -> str:
    code = code.upper()
    if not is_supported(code):
        raise HTTPException(status_code=400, detail=f"Unsupported currency: {code}")
    return code


def _payers(body: ExpenseRequest, total: int, currency: str, me: User, members: dict) -> dict[str, int]:
    if body.payers is None:
        return {str(me.id): total}
    payers: dict[str, int] = {}
    for p in body.payers:
        payers[str(p.user_id)] = payers.get(str(p.user_id), 0) + _money(p.amount, currency, "Paid amount")
    svc.require_members(payers, members, "Everyone who paid")
    try:
        validate_payers(total, payers)
    except MoneyError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return payers


def _shares(body: ExpenseRequest, total: int, currency: str, members: dict) -> tuple[dict[str, int], dict[str, str]]:
    svc.require_members([s.user_id for s in body.splits], members, "Everyone in the split")
    entries = []
    for s in body.splits:
        value = s.value
        if body.split_mode == "exact":
            value = str(_money(s.value or "0", currency, "Split amount"))
        entries.append((str(s.user_id), value))
    try:
        shares = split_manual(total, body.split_mode, entries)
    except MoneyError as e:
        raise HTTPException(status_code=400, detail=str(e))
    values = {str(s.user_id): s.value for s in body.splits if s.value is not None and body.split_mode != "equal"}
    return shares, values


async def _publish(db: AsyncSession, expense: Expense, action: str, card: tuple[list[str], dict] | None = None):
    if card:
        member_ids, payload = card
        await publish_users(member_ids, payload)
    else:
        member_ids = await MessageService.member_ids(db, expense.conversation_id)
    await publish_users(member_ids, svc.changed_event(expense, action))


async def _receipt_for(db: AsyncSession, expense: Expense) -> Receipt | None:
    return await db.get(Receipt, expense.receipt_id) if expense.receipt_id else None


@router.get("/currencies")
async def list_currencies():
    return _ok([{"code": c, "symbol": s, "name": n, "decimals": d} for c, (d, s, n) in CURRENCIES.items()])


@router.get("/expenses/conversations")
async def conversations_with_expenses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ids of your chats that have expenses (the Expenses tab shows these plus groups)."""
    from app.models.conversation_member import ConversationMember
    ids = (await db.execute(
        select(Expense.conversation_id).distinct()
        .join(ConversationMember, ConversationMember.conversation_id == Expense.conversation_id)
        .where(ConversationMember.user_id == current_user.id, Expense.deleted_at.is_(None))
    )).scalars().all()
    return _ok([str(i) for i in ids])


@router.get("/conversations/{conversation_id}/expenses")
async def list_expenses(
    conversation_id: uuid.UUID,
    include_deleted: bool = False,
    limit: int = Query(50, ge=1, le=200),
    before: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await svc.load_access(db, conversation_id, current_user)
    stmt = select(Expense).where(Expense.conversation_id == conversation_id)
    if not include_deleted:
        stmt = stmt.where(Expense.deleted_at.is_(None))
    if before:
        stmt = stmt.where(Expense.spent_at < before)
    expenses = (await db.execute(stmt.order_by(Expense.spent_at.desc(), Expense.created_at.desc()).limit(limit + 1))).scalars().all()
    return {**_ok([svc.serialize(e) for e in expenses[:limit]]), "has_more": len(expenses) > limit}


@router.post("/conversations/{conversation_id}/expenses")
async def create_expense(
    conversation_id: uuid.UUID,
    body: ExpenseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await svc.load_access(db, conversation_id, current_user)
    if body.split_mode == "itemized":
        raise HTTPException(status_code=400, detail="Itemized expenses come from a scanned receipt")
    currency = _currency(body.currency)
    total = _money(body.amount, currency)
    if total <= 0:
        raise HTTPException(status_code=400, detail="Amount must be more than zero")
    members = await svc.member_users(db, conversation_id)
    payers = _payers(body, total, currency, current_user, members)
    shares, values = _shares(body, total, currency, members)

    now = datetime.now(timezone.utc)
    expense = Expense(
        id=uuid.uuid4(), conversation_id=conversation_id, description=body.description.strip(),
        category=body.category if body.category in svc.CATEGORIES else "other",
        currency=currency, total_minor=total, source="manual", split_mode=body.split_mode,
        created_by=current_user.id, spent_at=body.spent_at or now, version=1, created_at=now, updated_at=now,
    )
    svc.set_parties(expense, payers, shares, values)
    db.add(expense)
    await db.flush()
    svc.record(db, expense, current_user, "created",
               f"added '{expense.description}' ({format_minor(total, currency)})", after=svc.snapshot(expense))
    card = await svc.post_card(db, expense, current_user,
                               f"{current_user.username} added '{expense.description}' · {format_minor(total, currency)}")
    await _publish(db, expense, "created", card)
    return _ok(svc.serialize(expense), "Expense added")


@router.get("/expenses/{expense_id}")
async def get_expense(
    expense_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    expense, access = await svc.load_expense(db, expense_id, current_user)
    data = svc.serialize(expense, await _receipt_for(db, expense))
    data["can_edit"] = not expense.locked and expense.deleted_at is None
    data["can_delete"] = expense.deleted_at is None and (access.is_admin or expense.created_by == current_user.id)
    data["can_admin"] = access.is_admin
    return _ok(data)


@router.put("/expenses/{expense_id}")
async def update_expense(
    expense_id: uuid.UUID,
    body: ExpenseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    expense, _ = await svc.load_expense(db, expense_id, current_user)
    if expense.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Restore this expense before editing it")
    if expense.locked:
        raise HTTPException(status_code=403, detail="This expense is locked. Ask an admin to unlock it")
    if body.version is None or body.version != expense.version:
        raise HTTPException(status_code=409, detail="Someone else changed this expense. Reload to see their changes")

    members = await svc.member_users(db, expense.conversation_id)
    before = svc.snapshot(expense)
    currency = _currency(body.currency)
    if body.split_mode == "itemized":
        # Item assignments live on the receipt; here only the details and payers can change
        if expense.split_mode != "itemized":
            raise HTTPException(status_code=400, detail="Itemized expenses come from a scanned receipt")
        if currency != expense.currency:
            raise HTTPException(status_code=400, detail="Change the currency on the receipt instead")
        total = expense.total_minor
        shares = {str(s.user_id): s.amount_minor for s in expense.shares}
        values = {}
    else:
        total = _money(body.amount, currency)
        if total <= 0:
            raise HTTPException(status_code=400, detail="Amount must be more than zero")
        shares, values = _shares(body, total, currency, members)
    payers = _payers(body, total, currency, current_user, members) if body.payers is not None else None
    if payers is None:
        payers = {str(p.user_id): p.amount_minor for p in expense.payers}
        try:
            validate_payers(total, payers)
        except MoneyError:
            raise HTTPException(status_code=400, detail="The amount changed: say who paid")

    expense.description = body.description.strip()
    expense.category = body.category if body.category in svc.CATEGORIES else "other"
    expense.currency = currency
    expense.total_minor = total
    expense.split_mode = body.split_mode
    if body.spent_at:
        expense.spent_at = body.spent_at
    svc.set_parties(expense, payers, shares, values)
    expense.version += 1
    expense.updated_at = datetime.now(timezone.utc)
    await db.flush()

    after = svc.snapshot(expense)
    summary = svc.describe_changes(before, after, members)
    svc.record(db, expense, current_user, "updated", summary, before, after)
    card = await svc.post_card(db, expense, current_user, f"{current_user.username} edited '{expense.description}': {summary}")
    await _publish(db, expense, "updated", card)
    return _ok(svc.serialize(expense), "Expense updated")


@router.delete("/expenses/{expense_id}")
async def delete_expense(
    expense_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    expense, access = await svc.load_expense(db, expense_id, current_user)
    if expense.deleted_at is not None:
        return _ok(svc.serialize(expense), "Already deleted")
    if not (access.is_admin or expense.created_by == current_user.id):
        raise HTTPException(status_code=403, detail="Only the person who added it or an admin can delete it")
    if expense.locked:
        raise HTTPException(status_code=403, detail="Unlock this expense before deleting it")
    expense.deleted_at = datetime.now(timezone.utc)
    expense.updated_at = expense.deleted_at
    expense.version += 1
    svc.record(db, expense, current_user, "deleted", f"deleted '{expense.description}'", before=svc.snapshot(expense))
    card = await svc.post_card(db, expense, current_user,
                               f"{current_user.username} deleted '{expense.description}' · {format_minor(expense.total_minor, expense.currency)}")
    await _publish(db, expense, "deleted", card)
    return _ok(svc.serialize(expense), "Expense deleted")


@router.post("/expenses/{expense_id}/restore")
async def restore_expense(
    expense_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    expense, access = await svc.load_expense(db, expense_id, current_user)
    if not (access.is_admin or expense.created_by == current_user.id):
        raise HTTPException(status_code=403, detail="Only the person who added it or an admin can restore it")
    if expense.deleted_at is None:
        return _ok(svc.serialize(expense), "Not deleted")
    expense.deleted_at = None
    expense.updated_at = datetime.now(timezone.utc)
    expense.version += 1
    svc.record(db, expense, current_user, "restored", f"restored '{expense.description}'", after=svc.snapshot(expense))
    card = await svc.post_card(db, expense, current_user, f"{current_user.username} restored '{expense.description}'")
    await _publish(db, expense, "restored", card)
    return _ok(svc.serialize(expense), "Expense restored")


@router.put("/expenses/{expense_id}/lock")
async def lock_expense(
    expense_id: uuid.UUID,
    body: LockRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    expense, access = await svc.load_expense(db, expense_id, current_user)
    if not access.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can lock expenses")
    if expense.locked != body.locked:
        expense.locked = body.locked
        expense.updated_at = datetime.now(timezone.utc)
        expense.version += 1
        action = "locked" if body.locked else "unlocked"
        svc.record(db, expense, current_user, action, f"{action} '{expense.description}'")
        await db.commit()
        await _publish(db, expense, action)
    return _ok(svc.serialize(expense))


@router.get("/expenses/{expense_id}/history")
async def expense_history(
    expense_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await svc.load_expense(db, expense_id, current_user)
    rows = (await db.execute(
        select(ExpenseEvent, User)
        .outerjoin(User, User.id == ExpenseEvent.actor_id)
        .where(ExpenseEvent.expense_id == expense_id)
        .order_by(ExpenseEvent.created_at.desc(), ExpenseEvent.id.desc())
    )).all()
    return _ok([
        {
            "id": event.id,
            "action": event.action,
            "summary": event.summary,
            "actor": {"id": str(user.id), "username": user.username} if user else None,
            "before": event.before,
            "after": event.after,
            "created_at": event.created_at.isoformat(),
        }
        for event, user in rows
    ])


# ------------------------------------------------------------------ settlements

def _serialize_settlement(s: Settlement) -> dict:
    return {
        "id": str(s.id),
        "conversation_id": str(s.conversation_id),
        "from_user": str(s.from_user),
        "to_user": str(s.to_user),
        "currency": s.currency,
        "amount_minor": s.amount_minor,
        "amount_display": format_minor(s.amount_minor, s.currency),
        "note": s.note,
        "created_by": str(s.created_by) if s.created_by else None,
        "deleted": s.deleted_at is not None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("/conversations/{conversation_id}/settlements")
async def list_settlements(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await svc.load_access(db, conversation_id, current_user)
    rows = (await db.execute(
        select(Settlement).where(Settlement.conversation_id == conversation_id, Settlement.deleted_at.is_(None))
        .order_by(Settlement.created_at.desc())
    )).scalars().all()
    return _ok([_serialize_settlement(s) for s in rows])


@router.post("/conversations/{conversation_id}/settlements")
async def create_settlement(
    conversation_id: uuid.UUID,
    body: SettlementRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await svc.load_access(db, conversation_id, current_user)
    currency = _currency(body.currency)
    amount = _money(body.amount, currency)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be more than zero")
    if body.from_user == body.to_user:
        raise HTTPException(status_code=400, detail="Choose two different people")
    members = await svc.member_users(db, conversation_id)
    svc.require_members([body.from_user, body.to_user], members, "Both people")

    settlement = Settlement(
        id=uuid.uuid4(), conversation_id=conversation_id, from_user=body.from_user, to_user=body.to_user,
        currency=currency, amount_minor=amount, note=(body.note or "").strip() or None,
        created_by=current_user.id, created_at=datetime.now(timezone.utc),
    )
    db.add(settlement)
    await db.flush()
    payer, payee = members[str(body.from_user)], members[str(body.to_user)]
    payload = await MessageService.post_system_message(
        db, conversation_id, current_user, f"{payer.username} paid {payee.username} {format_minor(amount, currency)}"
    )
    member_ids = list(members)
    await publish_users(member_ids, payload)
    await publish_users(member_ids, {"type": "expense_changed", "conversationId": str(conversation_id), "action": "settled"})
    return _ok(_serialize_settlement(settlement), "Payment recorded")


@router.delete("/settlements/{settlement_id}")
async def delete_settlement(
    settlement_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settlement = await db.get(Settlement, settlement_id)
    if settlement is None or settlement.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Payment not found")
    access = await svc.load_access(db, settlement.conversation_id, current_user)
    if not (access.is_admin or settlement.created_by == current_user.id):
        raise HTTPException(status_code=403, detail="Only the person who recorded it or an admin can remove it")
    settlement.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    member_ids = await MessageService.member_ids(db, settlement.conversation_id)
    await publish_users(member_ids, {"type": "expense_changed", "conversationId": str(settlement.conversation_id), "action": "settlement_removed"})
    return _ok(_serialize_settlement(settlement), "Payment removed")


# ------------------------------------------------------------------ balances & settings

@router.get("/conversations/{conversation_id}/balances")
async def get_balances(
    conversation_id: uuid.UUID,
    simplified: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await svc.load_access(db, conversation_id, current_user)
    settings = await svc.get_settings(db, conversation_id)
    use_simplified = settings.simplify_debts if simplified is None else simplified

    expenses = (await db.execute(
        select(Expense).where(Expense.conversation_id == conversation_id, Expense.deleted_at.is_(None))
    )).scalars().all()
    settlements = (await db.execute(
        select(Settlement).where(Settlement.conversation_id == conversation_id, Settlement.deleted_at.is_(None))
    )).scalars().all()
    plain_expenses = [
        SimpleNamespace(
            currency=e.currency,
            payers=[(str(p.user_id), p.amount_minor) for p in e.payers],
            shares=[(str(s.user_id), s.amount_minor) for s in e.shares],
        )
        for e in expenses
    ]
    plain_settlements = [
        SimpleNamespace(currency=s.currency, from_user=str(s.from_user), to_user=str(s.to_user), amount=s.amount_minor)
        for s in settlements
    ]
    nets = net_balances(plain_expenses, plain_settlements)
    debts = simplify(nets) if use_simplified else pairwise(plain_expenses, plain_settlements)

    me = str(current_user.id)
    currencies = sorted(set(nets) | {d.currency for d in debts})
    user_ids = {u for c in nets.values() for u in c} | {d.from_user for d in debts} | {d.to_user for d in debts}
    users = {}
    if user_ids:
        rows = (await db.execute(select(User).where(User.id.in_([uuid.UUID(u) for u in user_ids])))).scalars().all()
        users = {
            str(u.id): {"id": str(u.id), "username": u.username, "name": u.name, "avatar": media_storage.sign_url(u.avatar)}
            for u in rows
        }
    await db.commit()  # settings row may have just been created

    return _ok({
        "simplified": use_simplified,
        "default_currency": settings.default_currency,
        "users": users,
        "currencies": [
            {
                "currency": cur,
                "my_net_minor": nets.get(cur, {}).get(me, 0),
                "my_net_display": format_minor(nets.get(cur, {}).get(me, 0), cur),
                "nets": [{"user_id": u, "amount_minor": v} for u, v in sorted(nets.get(cur, {}).items(), key=lambda x: x[1])],
                "debts": [
                    {"from_user": d.from_user, "to_user": d.to_user, "amount_minor": d.amount,
                     "amount_display": format_minor(d.amount, cur)}
                    for d in debts if d.currency == cur
                ],
            }
            for cur in currencies
        ],
    })


async def _settings_data(db: AsyncSession, conversation_id: uuid.UUID, access: svc.Access) -> dict:
    settings = await svc.get_settings(db, conversation_id)
    return {
        "default_currency": settings.default_currency,
        "simplify_debts": settings.simplify_debts,
        "receipt_model_id": settings.receipt_model_id,
        "can_edit": access.is_admin,
    }


@router.get("/conversations/{conversation_id}/expense-settings")
async def get_expense_settings(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    access = await svc.load_access(db, conversation_id, current_user)
    data = await _settings_data(db, conversation_id, access)
    await db.commit()
    return _ok(data)


@router.put("/conversations/{conversation_id}/expense-settings")
async def update_expense_settings(
    conversation_id: uuid.UUID,
    body: SettingsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    access = await svc.load_access(db, conversation_id, current_user)
    if not access.is_admin:
        raise HTTPException(status_code=403, detail="Only group admins can change expense settings")
    settings = await svc.get_settings(db, conversation_id)
    if body.default_currency is not None:
        settings.default_currency = _currency(body.default_currency)
    if body.simplify_debts is not None:
        settings.simplify_debts = body.simplify_debts
    if body.receipt_model_id is not None:
        if body.receipt_model_id == 0:
            settings.receipt_model_id = None
        else:
            model = await db.get(AIModel, body.receipt_model_id)
            if model is None or not model.enabled:
                raise HTTPException(status_code=400, detail="That model isn't available")
            settings.receipt_model_id = model.id
    data = await _settings_data(db, conversation_id, access)
    await db.commit()
    member_ids = await MessageService.member_ids(db, conversation_id)
    await publish_users(member_ids, {"type": "expense_changed", "conversationId": str(conversation_id), "action": "settings"})
    return _ok(data, "Settings saved")
