# backend/app/services/safety.py
# Blocking: who has blocked whom, and what a block stops.
#
# A block stops direct messages both ways (WhatsApp works the same: you can't message someone you've
# blocked either), new direct chats, and being added to groups by that person. It doesn't remove
# anyone from groups you share, and it never touches shared expenses: money owed stays owed.

import uuid

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.conversation_member import ConversationMember
from app.models.safety import UserBlock

YOU_BLOCKED = "You blocked this person. Unblock them to send messages."
CANT_MESSAGE = "You can't message this person."


async def is_blocked_either_way(db: AsyncSession, a: uuid.UUID, b: uuid.UUID) -> bool:
    found = (await db.execute(select(UserBlock.blocker_id).where(or_(
        and_(UserBlock.blocker_id == a, UserBlock.blocked_id == b),
        and_(UserBlock.blocker_id == b, UserBlock.blocked_id == a),
    )).limit(1))).scalar_one_or_none()
    return found is not None


async def blocked_by(db: AsyncSession, user_id: uuid.UUID) -> set[uuid.UUID]:
    """The people this user has blocked."""
    return set((await db.execute(select(UserBlock.blocked_id).where(UserBlock.blocker_id == user_id))).scalars().all())


async def who_blocked(db: AsyncSession, user_id: uuid.UUID, among: list[uuid.UUID]) -> set[uuid.UUID]:
    """Which of `among` have blocked user_id (they get no notifications from them)."""
    if not among:
        return set()
    return set((await db.execute(select(UserBlock.blocker_id).where(
        UserBlock.blocked_id == user_id, UserBlock.blocker_id.in_(among),
    ))).scalars().all())


async def direct_message_refusal(db: AsyncSession, conversation_id: uuid.UUID, sender_id: uuid.UUID) -> str | None:
    """Why sender_id can't send in this chat, or None. Only direct chats are affected."""
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None or conversation.kind != "dm":
        return None
    other = (await db.execute(select(ConversationMember.user_id).where(
        ConversationMember.conversation_id == conversation_id, ConversationMember.user_id != sender_id,
    ).limit(1))).scalar_one_or_none()
    if other is None:
        return None
    rows = (await db.execute(select(UserBlock.blocker_id).where(or_(
        and_(UserBlock.blocker_id == sender_id, UserBlock.blocked_id == other),
        and_(UserBlock.blocker_id == other, UserBlock.blocked_id == sender_id),
    )))).scalars().all()
    if not rows:
        return None
    return YOU_BLOCKED if sender_id in rows else CANT_MESSAGE
