# backend/app/api/v1/messages.py

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.message import Message, MessageType
from app.models.message_reaction import MessageReaction
from app.models.user import User
from app.services import media_storage
from app.services.message_service import MessageService
from app.websocket.routes import MAX_TEXT_LENGTH, publish_users

router = APIRouter(prefix="/messages", tags=["Messages"])

# A message that was just sent may still be on its way to the DB through the worker
PERSIST_WAIT_SECONDS = 3

ALLOWED_REACTIONS = {"👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉", "👏", "😍", "😡", "👀"}


class EditMessageRequest(BaseModel):
    text: str = Field(..., max_length=MAX_TEXT_LENGTH)

    @field_validator("text")
    @classmethod
    def strip_text(cls, v: str) -> str:
        return v.strip()


class ReactRequest(BaseModel):
    emoji: str = Field(..., max_length=16)


async def _load_own_message(db: AsyncSession, message_id: UUID, user: User) -> Message:
    message = await MessageService.get_message(db, message_id, wait_seconds=PERSIST_WAIT_SECONDS)
    if message is None or not await MessageService.is_member(db, message.conversation_id, user.id):
        raise HTTPException(status_code=404, detail="Message not found")
    if message.sender_id != user.id:
        raise HTTPException(status_code=403, detail="You can only change your own messages")
    if message.is_deleted:
        raise HTTPException(status_code=400, detail="Message was deleted")
    if message.message_type == MessageType.SYSTEM:
        raise HTTPException(status_code=400, detail="System messages can't be changed")
    return message


@router.patch("/{message_id}")
async def edit_message(
    message_id: UUID,
    payload: EditMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit the text (or caption) of your own message"""
    message = await _load_own_message(db, message_id, current_user)
    if not payload.text and not message.media_url:
        raise HTTPException(status_code=400, detail="Message can't be empty")

    message.text = payload.text
    message.updated_at = datetime.now(timezone.utc)
    await db.commit()

    event = {
        "type": "message_updated",
        "roomId": str(message.conversation_id),
        "messageId": str(message.id),
        "text": message.text,
        "editedAt": message.updated_at.isoformat(),
        "isDeleted": False,
    }
    await publish_users(await MessageService.member_ids(db, message.conversation_id), event)
    return {"success": True, "message": "Message edited", "data": event}


@router.delete("/{message_id}")
async def delete_message(
    message_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete your own message for everyone"""
    message = await _load_own_message(db, message_id, current_user)

    media_url = message.media_url
    message.is_deleted = True
    message.text = ""
    message.media_url = None
    message.media_thumbnail = None
    message.media_filename = None
    message.media_size = None
    message.updated_at = datetime.now(timezone.utc)
    await db.execute(delete(MessageReaction).where(MessageReaction.message_id == message.id))
    await db.commit()

    # Remove the file too, unless another message still points at it
    if media_url:
        still_used = (await db.execute(
            select(Message.id).where(Message.media_url == media_url).limit(1)
        )).scalar_one_or_none()
        key = media_storage.key_from_url(media_url)
        path = media_storage.path_for_key(key) if key else None
        if not still_used and path is not None:
            path.unlink(missing_ok=True)

    event = {
        "type": "message_updated",
        "roomId": str(message.conversation_id),
        "messageId": str(message.id),
        "isDeleted": True,
    }
    await publish_users(await MessageService.member_ids(db, message.conversation_id), event)
    return {"success": True, "message": "Message deleted", "data": event}


@router.put("/{message_id}/reaction")
async def react_to_message(
    message_id: UUID,
    payload: ReactRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Set your reaction on a message. Sending the same emoji again removes it;
    a different emoji replaces your previous one.
    """
    if payload.emoji not in ALLOWED_REACTIONS:
        raise HTTPException(status_code=400, detail="Unsupported reaction")

    message = await MessageService.get_message(db, message_id, wait_seconds=PERSIST_WAIT_SECONDS)
    if message is None or not await MessageService.is_member(db, message.conversation_id, current_user.id):
        raise HTTPException(status_code=404, detail="Message not found")
    if message.is_deleted or message.message_type == MessageType.SYSTEM:
        raise HTTPException(status_code=400, detail="Can't react to this message")

    existing = (await db.execute(
        select(MessageReaction).where(
            MessageReaction.message_id == message.id,
            MessageReaction.user_id == current_user.id,
        )
    )).scalar_one_or_none()

    if existing and existing.emoji == payload.emoji:
        await db.delete(existing)
    elif existing:
        existing.emoji = payload.emoji
    else:
        db.add(MessageReaction(message_id=message.id, user_id=current_user.id, emoji=payload.emoji))
    await db.commit()

    reactions = (await MessageService.reactions_for(db, [message.id])).get(message.id, [])
    event = {
        "type": "reactions_updated",
        "roomId": str(message.conversation_id),
        "messageId": str(message.id),
        "reactions": MessageService.camel_reactions(reactions),
    }
    await publish_users(await MessageService.member_ids(db, message.conversation_id), event)
    return {"success": True, "message": "Reaction updated", "data": event}
