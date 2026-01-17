# backend/app/services/chat_service.py

import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from app.models.user import User
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