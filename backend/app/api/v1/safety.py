# backend/app/api/v1/safety.py
# Block and unblock people, report abuse, and (app admins) review reports.

import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core import rate_limit as rl
from app.db.session import get_db
from app.models.conversation import Conversation
from app.models.conversation_member import ConversationMember
from app.models.message import Message
from app.models.safety import REPORT_OUTCOMES, REPORT_REASONS, AccountNotice, Report, UserBlock
from app.models.user import User
from app.services import admin as admin_service
from app.services import media_storage
from app.services import notices as notice_service
from app.websocket.routes import publish_users

router = APIRouter(tags=["Safety"])

class ReportRequest(BaseModel):
    user_id: Optional[uuid.UUID] = None
    conversation_id: Optional[uuid.UUID] = None
    message_id: Optional[uuid.UUID] = None
    reason: Literal["spam", "harassment", "scam", "inappropriate", "impersonation", "other"]
    details: Optional[str] = Field(None, max_length=1000)
    # What the reporter chose to share (encrypted messages can only reach a reviewer this way)
    evidence: Optional[str] = Field(None, max_length=5000)
    block: bool = False

class ResolveRequest(BaseModel):
    resolution: str = Field(..., min_length=1, max_length=500)  # the admins' own note
    # Told to the reporter (without details). Older clients leave it out: then nobody is told anything.
    outcome: Optional[Literal["action_taken", "no_violation"]] = None
    # Warn the reported person: the rule (defaults to the report's reason) and a message they'll read
    warn: bool = False
    warning_reason: Optional[str] = None
    warning_message: Optional[str] = Field(None, max_length=500)


class ReadNoticesRequest(BaseModel):
    ids: Optional[list[uuid.UUID]] = None  # None: all of them

def _person(u: User | None) -> dict | None:
    if u is None:
        return None
    return {"id": str(u.id), "username": u.username, "name": u.name, "avatar": media_storage.sign_url(u.avatar)}

async def _target(db: AsyncSession, user_id: uuid.UUID, me: User) -> User:
    if user_id == me.id:
        raise HTTPException(status_code=400, detail="You can't block yourself")
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Person not found")
    return user

# ------------------------------------------------------------------ blocking

@router.get("/users/blocked")
async def list_blocked(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """People you've blocked, newest first (Settings → Blocked people)."""
    rows = (await db.execute(
        select(UserBlock, User).join(User, User.id == UserBlock.blocked_id)
        .where(UserBlock.blocker_id == current_user.id).order_by(UserBlock.created_at.desc())
    )).all()
    return {"success": True, "data": [{**_person(u), "blocked_at": b.created_at.isoformat()} for b, u in rows]}

@router.post("/users/{user_id}/block")
async def block(user_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Stop direct messages both ways, new chats and group adds from this person. They aren't told."""
    await _target(db, user_id, current_user)
    await db.execute(insert(UserBlock).values(blocker_id=current_user.id, blocked_id=user_id).on_conflict_do_nothing())
    await db.commit()
    # Your other devices update their chat (composer, info panel)
    await publish_users([str(current_user.id)], {"type": "block_changed", "userId": str(user_id), "blocked": True})
    return {"success": True, "message": "Blocked", "data": {"blocked": True}}

@router.delete("/users/{user_id}/block")
async def unblock(user_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(UserBlock).where(UserBlock.blocker_id == current_user.id, UserBlock.blocked_id == user_id))
    await db.commit()
    await publish_users([str(current_user.id)], {"type": "block_changed", "userId": str(user_id), "blocked": False})
    return {"success": True, "message": "Unblocked", "data": {"blocked": False}}

# ------------------------------------------------------------------ reports

@router.post("/reports")
async def report(body: ReportRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Report a person, a message or a group to the ShareEven team. Optionally block the person too."""
    await rl.enforce((rl.REPORTS_PER_USER, str(current_user.id)))
    if not (body.user_id or body.conversation_id or body.message_id):
        raise HTTPException(status_code=400, detail="Say who or what you're reporting")

    reported_user = body.user_id
    conversation_id = body.conversation_id
    if body.message_id:
        message = await db.get(Message, body.message_id)
        if message is None:
            raise HTTPException(status_code=404, detail="Message not found")
        conversation_id = conversation_id or message.conversation_id
        if message.conversation_id != conversation_id:
            raise HTTPException(status_code=400, detail="That message isn't in this chat")
        reported_user = reported_user or message.sender_id
    if conversation_id:
        member = (await db.execute(select(ConversationMember.user_id).where(
            ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == current_user.id,
        ))).scalar_one_or_none()
        if member is None:
            raise HTTPException(status_code=404, detail="Chat not found")
    if reported_user == current_user.id:
        raise HTTPException(status_code=400, detail="You can't report yourself")
    if reported_user and await db.get(User, reported_user) is None:
        raise HTTPException(status_code=404, detail="Person not found")

    db.add(Report(
        reporter_id=current_user.id, reported_user_id=reported_user, conversation_id=conversation_id,
        message_id=body.message_id, reason=body.reason, details=(body.details or "").strip() or None,
        evidence=(body.evidence or "").strip() or None,
    ))
    if body.block and reported_user:
        await db.execute(insert(UserBlock).values(blocker_id=current_user.id, blocked_id=reported_user).on_conflict_do_nothing())
    await db.commit()
    if body.block and reported_user:
        await publish_users([str(current_user.id)], {"type": "block_changed", "userId": str(reported_user), "blocked": True})
    return {"success": True, "message": "Thanks, we'll look into it", "data": {"reported": True, "blocked": bool(body.block and reported_user)}}

# ------------------------------------------------------------------ app admins

def _require_admin(user: User) -> None:
    if not user.is_app_admin:
        raise HTTPException(status_code=403, detail="Only app admins can review reports")

@router.get("/admin/reports")
async def list_reports(
    status: Literal["open", "resolved"] = "open",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reports to review, oldest open first; each with who reported whom and how often that person was reported."""
    _require_admin(current_user)
    reports = (await db.execute(
        select(Report).where(Report.status == status)
        .order_by(Report.created_at.asc() if status == "open" else Report.resolved_at.desc()).limit(200)
    )).scalars().all()
    ids = {r.reporter_id for r in reports} | {r.reported_user_id for r in reports}
    users = {u.id: u for u in (await db.execute(select(User).where(User.id.in_([i for i in ids if i])))).scalars().all()} if ids else {}
    convs = {c.id: c for c in (await db.execute(
        select(Conversation).where(Conversation.id.in_([r.conversation_id for r in reports if r.conversation_id]))
    )).scalars().all()} if reports else {}
    counts: dict[uuid.UUID, int] = {}
    for (uid,) in (await db.execute(select(Report.reported_user_id).where(Report.reported_user_id.in_(list(users))))).all():
        counts[uid] = counts.get(uid, 0) + 1
    return {"success": True, "data": [{
        "id": str(r.id), "reason": r.reason, "details": r.details, "evidence": r.evidence, "status": r.status,
        "reporter": _person(users.get(r.reporter_id)), "reported_user": _person(users.get(r.reported_user_id)),
        "times_reported": counts.get(r.reported_user_id, 0) if r.reported_user_id else 0,
        "conversation": {"id": str(r.conversation_id), "kind": convs[r.conversation_id].kind, "title": convs[r.conversation_id].title}
        if r.conversation_id in convs else None,
        "message_id": str(r.message_id) if r.message_id else None,
        "resolution": r.resolution, "outcome": r.outcome, "created_at": r.created_at.isoformat(),
        "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
    } for r in reports]}

@router.post("/admin/reports/{report_id}/resolve")
async def resolve_report(
    report_id: uuid.UUID, body: ResolveRequest,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    r = await db.get(Report, report_id)
    if r is None:
        raise HTTPException(status_code=404, detail="Report not found")
    if r.status == "resolved":
        raise HTTPException(status_code=409, detail="This report was already resolved")
    if body.warn and not r.reported_user_id:
        raise HTTPException(status_code=400, detail="There's no one to warn on this report")
    warning_reason = body.warning_reason or r.reason
    if body.warn and warning_reason not in REPORT_REASONS:
        raise HTTPException(status_code=400, detail="Choose which rule was broken")
    # Warning someone means action was taken, whatever was picked
    outcome = "action_taken" if body.warn else body.outcome
    r.status, r.resolution, r.resolved_by, r.resolved_at = "resolved", body.resolution.strip(), current_user.id, datetime.now(timezone.utc)
    r.outcome = outcome
    await admin_service.log(db, current_user, "resolve_report", r.reported_user_id, r.resolution, report_id=str(r.id), outcome=outcome)

    sent: list[AccountNotice] = []
    if body.warn:
        sent.append(notice_service.warning(r.reported_user_id, warning_reason, body.warning_message, r.id))
        await admin_service.log(db, current_user, "warn", r.reported_user_id, (body.warning_message or "").strip() or None,
                                rule=warning_reason, report_id=str(r.id))
    if outcome and r.reporter_id:
        reported = await db.get(User, r.reported_user_id) if r.reported_user_id else None
        sent.append(notice_service.report_update(r.reporter_id, outcome, reported.username if reported else None, r.id))
    db.add_all(sent)
    await db.commit()
    await notice_service.deliver(db, sent)
    return {"success": True, "message": "Report resolved", "data": {"id": str(r.id), "outcome": outcome, "warned": body.warn}}


# ------------------------------------------------------------------ notices (warnings, report updates)

@router.get("/notices")
async def my_notices(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Messages from the ShareEven team to me, newest first."""
    rows = (await db.execute(
        select(AccountNotice).where(AccountNotice.user_id == current_user.id).order_by(AccountNotice.created_at.desc()).limit(50)
    )).scalars().all()
    return {"success": True, "data": {"notices": [notice_service.view(n) for n in rows], "unread": sum(1 for n in rows if n.read_at is None)}}


@router.post("/notices/read")
async def read_notices(body: ReadNoticesRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    query = update(AccountNotice).where(AccountNotice.user_id == current_user.id, AccountNotice.read_at.is_(None))
    if body.ids is not None:
        query = query.where(AccountNotice.id.in_(body.ids))
    await db.execute(query.values(read_at=datetime.now(timezone.utc)))
    await db.commit()
    return {"success": True, "data": None}
