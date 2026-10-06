# backend/app/services/message_service.py

"""
Helpers shared by the REST API and the WebSocket handler for building message
payloads (replies, reactions, edits, deletes) and posting system messages.
"""

import asyncio
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.conversation_member import ConversationMember
from app.models.message import Message, MessageType
from app.models.message_reaction import MessageReaction
from app.models.user import User
from app.services import media_storage

DELETED_TEXT = "This message was deleted"
REPLY_PREVIEW_LENGTH = 120


class MessageService:
    @staticmethod
    async def member_ids(db: AsyncSession, conversation_id: uuid.UUID) -> list[str]:
        result = await db.execute(
            select(ConversationMember.user_id).where(ConversationMember.conversation_id == conversation_id)
        )
        return [str(uid) for uid in result.scalars().all()]

    @staticmethod
    async def is_member(db: AsyncSession, conversation_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        result = await db.execute(
            select(ConversationMember.id).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none() is not None

    @staticmethod
    async def get_message(
        db: AsyncSession,
        message_id: uuid.UUID,
        wait_seconds: float = 0,
    ) -> Message | None:
        """
        Load a message. With wait_seconds, keep retrying for a just-sent message
        that the worker hasn't persisted yet.
        """
        deadline = asyncio.get_event_loop().time() + wait_seconds
        while True:
            message = await db.get(Message, message_id, populate_existing=True)
            if message is not None or asyncio.get_event_loop().time() >= deadline:
                return message
            await asyncio.sleep(0.2)

    @staticmethod
    def preview_text(message: Message) -> str:
        if message.is_deleted:
            return DELETED_TEXT
        return media_storage.preview_text(
            message.message_type.value, message.text, message.media_filename
        )[:REPLY_PREVIEW_LENGTH]

    @staticmethod
    async def reply_previews(db: AsyncSession, reply_ids: set[uuid.UUID]) -> dict[uuid.UUID, dict]:
        """reply_to_id -> preview of the original message (snake_case, for REST)"""
        if not reply_ids:
            return {}
        rows = (await db.execute(
            select(Message, User.username)
            .outerjoin(User, User.id == Message.sender_id)
            .where(Message.id.in_(reply_ids))
        )).all()
        return {
            msg.id: {
                "id": str(msg.id),
                "text": MessageService.preview_text(msg),
                "sender_id": str(msg.sender_id),
                "sender_name": username,
                "message_type": msg.message_type.value,
                "is_deleted": msg.is_deleted,
            }
            for msg, username in rows
        }

    @staticmethod
    async def reactions_for(db: AsyncSession, message_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[dict]]:
        """message_id -> [{emoji, user_ids}] in first-reacted order"""
        if not message_ids:
            return {}
        rows = (await db.execute(
            select(MessageReaction)
            .where(MessageReaction.message_id.in_(message_ids))
            .order_by(MessageReaction.created_at)
        )).scalars().all()

        grouped: dict[uuid.UUID, dict[str, list[str]]] = defaultdict(dict)
        for reaction in rows:
            grouped[reaction.message_id].setdefault(reaction.emoji, []).append(str(reaction.user_id))
        return {
            message_id: [{"emoji": emoji, "user_ids": users} for emoji, users in by_emoji.items()]
            for message_id, by_emoji in grouped.items()
        }

    @staticmethod
    def camel_reactions(reactions: list[dict]) -> list[dict]:
        return [{"emoji": r["emoji"], "userIds": r["user_ids"]} for r in reactions]

    @staticmethod
    def camel_reply(reply: dict | None) -> dict | None:
        if not reply:
            return None
        return {
            "id": reply["id"],
            "text": reply["text"],
            "senderId": reply["sender_id"],
            "senderName": reply["sender_name"],
            "messageType": reply["message_type"],
            "isDeleted": reply["is_deleted"],
        }

    @staticmethod
    async def post_system_message(
        db: AsyncSession,
        conversation_id: uuid.UUID,
        actor: User,
        text: str,
        expense_id: uuid.UUID | None = None,
    ) -> dict:
        """
        Store a system message ("alice added bob") and return its WebSocket payload.
        With expense_id the chat shows it as an expense card.
        Written directly (not via the worker) so it is in the DB before anyone reacts to it.
        """
        now = datetime.now(timezone.utc)
        message = Message(
            id=uuid.uuid4(),
            conversation_id=conversation_id,
            sender_id=actor.id,
            message_type=MessageType.SYSTEM,
            text=text,
            created_at=now,
            expense_id=expense_id,
        )
        db.add(message)
        await db.execute(
            update(Conversation).where(Conversation.id == conversation_id).values(updated_at=now)
        )
        await db.commit()

        return {
            "type": "message",
            "roomId": str(conversation_id),
            "messageId": str(message.id),
            "senderId": str(actor.id),
            "senderName": actor.username,
            "senderAvatar": media_storage.sign_url(actor.avatar),
            "text": text,
            "messageType": "system",
            "expenseId": str(expense_id) if expense_id else None,
            "timestamp": now.isoformat(),
            "status": "delivered",
        }
