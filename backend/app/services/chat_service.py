# backend/app/services/chat_service.py

import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func, update
from app.models.user import User
from app.models.message import Message
from app.models.message_receipt import MessageReceipt, ReceiptStatus
from app.models.conversation import Conversation
from app.models.conversation_member import ConversationMember, MemberRole

class ChatService:
    @staticmethod
    async def search_users(db: AsyncSession, q: str, limit: int = 10) -> list[User]:
        stmt = select(User).where(
            or_(User.email.ilike(f"%{q}%"), User.username.ilike(f"%{q}%"))
        ).limit(limit)
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_dm(db: AsyncSession, current_user_id: uuid.UUID, other_user_id: uuid.UUID) -> Conversation:
        # Check if DM already exists
        stmt = (
            select(Conversation.id)
            .join(ConversationMember)
            .where(
                and_(
                    Conversation.kind == 'dm',
                    ConversationMember.user_id.in_([current_user_id, other_user_id])
                )
            )
            .group_by(Conversation.id)
            .having(func.count(ConversationMember.user_id) == 2)
        )
        result = await db.execute(stmt)
        existing_conv_id = result.scalar_one_or_none()

        if existing_conv_id:
            # Return existing conversation
            stmt = select(Conversation).where(Conversation.id == existing_conv_id)
            result = await db.execute(stmt)
            return result.scalar_one()

        # Create new DM
        conv = Conversation(kind="dm", title=None)
        db.add(conv)
        await db.flush()  # Get the ID

        # Add members with role enum
        db.add_all([
            ConversationMember(
                conversation_id=conv.id, 
                user_id=current_user_id, 
                role=MemberRole.MEMBER  # ✅ Use enum
            ),
            ConversationMember(
                conversation_id=conv.id, 
                user_id=other_user_id, 
                role=MemberRole.MEMBER  # ✅ Use enum
            ),
        ])
        
        await db.commit()
        await db.refresh(conv)
        return conv

    @staticmethod
    async def create_group(
        db: AsyncSession, 
        current_user_id: uuid.UUID, 
        title: str, 
        member_ids: list[uuid.UUID]
    ) -> Conversation:
        # Create conversation
        conv = Conversation(kind="group", title=title)
        db.add(conv)
        await db.flush()

        # Creator is admin
        db.add(ConversationMember(
            conversation_id=conv.id, 
            user_id=current_user_id, 
            role=MemberRole.ADMIN  # ✅ Use enum
        ))
        
        # Other members
        for uid in member_ids:
            if uid != current_user_id:
                db.add(ConversationMember(
                    conversation_id=conv.id, 
                    user_id=uid, 
                    role=MemberRole.MEMBER  # ✅ Use enum
                ))

        await db.commit()
        await db.refresh(conv)
        return conv
    # -----------------------------
    # Read state
    # -----------------------------
    @staticmethod
    async def read_up_to(db: AsyncSession, conversation_id: uuid.UUID) -> datetime | None:
        """
        Timestamp up to which every member has read the conversation, or None
        if some member hasn't read anything yet. A sender's own read pointer is
        moved forward when they send, so this is also "read by all recipients".
        """
        stmt = (
            select(Message.created_at)
            .select_from(ConversationMember)
            .outerjoin(Message, Message.id == ConversationMember.last_read_message_id)
            .where(ConversationMember.conversation_id == conversation_id)
        )
        timestamps = list((await db.execute(stmt)).scalars().all())
        if not timestamps or any(ts is None for ts in timestamps):
            return None
        return min(timestamps)

    @staticmethod
    async def mark_read(
        db: AsyncSession,
        user_id: uuid.UUID,
        conversation_id: uuid.UUID,
        message_id: uuid.UUID | None = None,
    ) -> Message | None:
        """
        Mark everything up to message_id (or the latest message) as read by user_id.
        Moves the member's read pointer forward only, and updates receipts.
        Returns the message the pointer now refers to, or None if nothing to mark.
        """
        if message_id is not None:
            target = (await db.execute(
                select(Message).where(
                    Message.id == message_id,
                    Message.conversation_id == conversation_id,
                )
            )).scalar_one_or_none()
        else:
            target = (await db.execute(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.created_at.desc())
                .limit(1)
            )).scalar_one_or_none()
        if target is None:
            return None

        member = (await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
            )
        )).scalar_one_or_none()
        if member is None:
            return None

        current_ts = None
        if member.last_read_message_id:
            current_ts = (await db.execute(
                select(Message.created_at).where(Message.id == member.last_read_message_id)
            )).scalar_one_or_none()

        now = datetime.now(timezone.utc)
        if current_ts is None or target.created_at > current_ts:
            member.last_read_message_id = target.id
            member.last_read_at = now

        await db.execute(
            update(MessageReceipt)
            .where(
                MessageReceipt.user_id == user_id,
                MessageReceipt.status != ReceiptStatus.READ,
                MessageReceipt.message_id.in_(
                    select(Message.id).where(
                        Message.conversation_id == conversation_id,
                        Message.created_at <= target.created_at,
                    )
                ),
            )
            .values(status=ReceiptStatus.READ, read_at=now)
        )
        await db.commit()
        return target
