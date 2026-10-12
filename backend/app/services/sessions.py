# backend/app/services/sessions.py
"""Revocable sign-ins (app.models.auth_session): create, check and revoke."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth_session import AuthSession

# The apps look for this message: the device was logged out, so its local keys and messages are wiped
LOGGED_OUT = "This device was logged out"


async def start(db: AsyncSession, user_id: uuid.UUID, user_agent: Optional[str] = None) -> uuid.UUID:
    session = AuthSession(user_id=user_id, user_agent=(user_agent or "")[:200] or None)
    db.add(session)
    await db.flush()
    return session.id


async def is_active(db: AsyncSession, session_id: Optional[str], user_id: uuid.UUID) -> bool:
    """Tokens from before sessions existed carry no id and stay valid until they expire."""
    if not session_id:
        return True
    try:
        sid = uuid.UUID(str(session_id))
    except ValueError:
        return False
    session = await db.get(AuthSession, sid)
    return session is not None and session.user_id == user_id and session.revoked_at is None


async def revoke(db: AsyncSession, session_id: Optional[uuid.UUID]) -> None:
    if session_id:
        await db.execute(update(AuthSession).where(AuthSession.id == session_id, AuthSession.revoked_at.is_(None))
                         .values(revoked_at=datetime.now(timezone.utc)))


def id_from_request(request) -> Optional[uuid.UUID]:
    """The session id in the request's (already checked) bearer token, if any."""
    from jose import jwt
    from app.config.settings import settings
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    try:
        sid = jwt.decode(header[7:], settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]).get("sid")
        return uuid.UUID(sid) if sid else None
    except Exception:
        return None
