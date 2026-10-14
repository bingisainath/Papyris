# backend/app/services/admin.py
"""
App admins: suspending accounts, the action log, and the numbers on the admin overview.

Admins never see what anyone's messages say (they're end-to-end encrypted): only accounts,
counts, and reports, where a reporter may have chosen to share a message's text.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import Date, cast, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin import AdminAction
from app.models.auth_session import AuthSession
from app.models.e2e_v2 import E2EDevice
from app.models.expense import Expense
from app.models.message import Message
from app.models.receipt import Receipt
from app.models.safety import Report
from app.models.user import User

SUSPENDED = "This account is suspended"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def suspension_text(user: User) -> str:
    """What the person sees when they try to sign in."""
    until = (f" until {user.suspended_until.strftime('%-d %b %Y, %H:%M')} UTC"
             if user.suspended_until else "")
    reason = f" Reason: {user.suspension_reason.rstrip('.')}." if user.suspension_reason else ""
    return f"Your account is suspended{until}.{reason} If you think this is a mistake, write to support@shareeven.com."


def refuse_sign_in_if_suspended(user: User) -> None:
    """Signing in (or finishing sign-up) while suspended: say why and until when."""
    from fastapi import HTTPException
    if user.suspended_now():
        raise HTTPException(status_code=403, detail={"message": suspension_text(user), "code": "account_suspended"})


async def log(db: AsyncSession, admin: User, action: str, target: Optional[uuid.UUID] = None,
              reason: Optional[str] = None, **details) -> None:
    db.add(AdminAction(admin_id=admin.id, action=action, target_user_id=target, reason=reason,
                       details=details or None))


async def suspend(db: AsyncSession, user: User, reason: str, days: Optional[int]) -> None:
    user.suspended_at = _now()
    user.suspended_until = _now() + timedelta(days=days) if days else None
    user.suspension_reason = reason


def unsuspend(user: User) -> None:
    user.suspended_at = user.suspended_until = user.suspension_reason = None


async def revoke_all_sessions(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(update(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
                              .values(revoked_at=_now()))
    return result.rowcount or 0


# ------------------------------------------------------------------ overview

async def _per_day(db: AsyncSession, column, since: datetime, *where, count=None) -> dict[str, int]:
    day = cast(func.timezone("UTC", column), Date)  # UTC days, same as _series (not the DB or server time zone)
    rows = (await db.execute(
        select(day, count if count is not None else func.count()).where(column >= since, *where).group_by(day)
    )).all()
    return {d.isoformat(): n for d, n in rows}


def _series(counts: dict[str, int], days: int) -> list[dict]:
    today = _now().date()  # UTC
    return [{"day": (d := (today - timedelta(days=days - 1 - i)).isoformat()), "count": counts.get(d, 0)} for i in range(days)]


async def _active_users(db: AsyncSession, since: datetime) -> int:
    """People who used the app: a device of theirs checked in, or they sent something."""
    devices = select(E2EDevice.user_id).where(E2EDevice.last_seen_at >= since)
    senders = select(Message.sender_id).where(Message.created_at >= since)
    people = devices.union(senders).subquery()  # UNION drops duplicates
    return await db.scalar(select(func.count()).select_from(people))


async def overview(db: AsyncSession, days: int = 30) -> dict:
    now = _now()
    since = now - timedelta(days=days - 1)
    since = since.replace(hour=0, minute=0, second=0, microsecond=0)
    real = (User.deleted_at.is_(None),)

    scans = (await db.execute(
        select(Receipt.model, Receipt.key_source, func.count(),
               func.coalesce(func.sum(Receipt.usage["input_tokens"].as_integer()), 0),
               func.coalesce(func.sum(Receipt.usage["output_tokens"].as_integer()), 0))
        .where(Receipt.created_at >= since).group_by(Receipt.model, Receipt.key_source)
    )).all()

    return {
        "days": days,
        "totals": {
            "users": await db.scalar(select(func.count()).select_from(User).where(*real)),
            "suspended": await db.scalar(select(func.count()).select_from(User).where(
                *real, User.suspended_at.is_not(None), or_(User.suspended_until.is_(None), User.suspended_until > now))),
            "active_today": await _active_users(db, now - timedelta(days=1)),
            "active_7_days": await _active_users(db, now - timedelta(days=7)),
            "active_30_days": await _active_users(db, now - timedelta(days=30)),
            "open_reports": await db.scalar(select(func.count()).select_from(Report).where(Report.status == "open")),
        },
        "series": {
            "signups": _series(await _per_day(db, User.created_at, since, *real), days),
            "messages": _series(await _per_day(db, Message.created_at, since), days),
            "expenses": _series(await _per_day(db, Expense.created_at, since, Expense.deleted_at.is_(None)), days),
            "receipt_scans": _series(await _per_day(db, Receipt.created_at, since), days),
        },
        "receipt_models": [
            {"model": model or "unknown", "key": key or "app", "scans": n, "input_tokens": int(i), "output_tokens": int(o)}
            for model, key, n, i, o in sorted(scans, key=lambda r: -r[2])
        ],
    }
