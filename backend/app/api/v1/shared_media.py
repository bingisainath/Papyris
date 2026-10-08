# backend/app/api/v1/shared_media.py

"""
"Media, links and docs" in a chat's info: everything shared in the conversation, newest first.
  media = photos and videos, docs = files and voice notes, links = web addresses in messages
"""

import re
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.message import Message, MessageType
from app.models.user import User
from app.services import media_storage
from app.services.message_service import MessageService

router = APIRouter(tags=["Messages"])

URL_RE = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)
KINDS = {
    "media": (MessageType.IMAGE, MessageType.VIDEO),
    "docs": (MessageType.FILE, MessageType.AUDIO),
}


@router.get("/conversations/{conversation_id}/shared")
async def shared_items(
    conversation_id: UUID,
    kind: Literal["media", "docs", "links"] = "media",
    before: Optional[datetime] = None,
    limit: int = Query(60, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await MessageService.is_member(db, conversation_id, current_user.id):
        raise HTTPException(status_code=404, detail="Conversation not found")

    stmt = select(Message, User.username).outerjoin(User, User.id == Message.sender_id).where(
        Message.conversation_id == conversation_id, Message.is_deleted.is_(False)
    )
    if kind == "links":
        # Encrypted messages can't be searched here: the sender flags the ones with a link
        plain = ~Message.text.startswith(media_storage.ENCRYPTED_PREFIX)
        stmt = stmt.where(or_(and_(plain, Message.text.ilike("%http%")), Message.has_link.is_(True)))
    else:
        stmt = stmt.where(Message.message_type.in_(KINDS[kind]), Message.media_url.is_not(None))
    if before:
        stmt = stmt.where(Message.created_at < before)
    rows = (await db.execute(stmt.order_by(Message.created_at.desc()).limit(limit + 1))).all()

    items = []
    for message, sender_name in rows[:limit]:
        base = {
            "message_id": str(message.id),
            "sender_id": str(message.sender_id),
            "sender_name": sender_name,
            "created_at": message.created_at.isoformat(),
        }
        if kind == "links" and media_storage.is_encrypted(message.text):
            items.append({**base, "encrypted": True, "text": message.text})  # the app decrypts and lists the links
            continue
        if kind == "links":
            for url in dict.fromkeys(URL_RE.findall(message.text or "")):
                items.append({**base, "url": url.rstrip(".,);!?"), "text": message.text})
            continue
        items.append({
            **base,
            "media_type": message.message_type.value,
            "media_url": media_storage.sign_url(message.media_url),
            "media_thumbnail": media_storage.sign_url(message.media_thumbnail),
            "media_filename": message.media_filename,
            "media_size": message.media_size,
            "media_width": message.media_width,
            "media_height": message.media_height,
            "media_duration": message.media_duration,
            "text": message.text,
        })
    return {"success": True, "message": "OK", "data": items, "has_more": len(rows) > limit}
