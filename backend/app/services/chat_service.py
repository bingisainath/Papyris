import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.models.user import User
from app.models.conversation import Conversation, ConversationMember

class ChatService:
    @staticmethod
    async def search_users(db: AsyncSession, q: str, limit: int = 10) -> list[User]:
        stmt = select(User).where(
            or_(User.email.ilike(f"%{q}%"), User.username.ilike(f"%{q}%"))
        ).limit(limit)
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_dm(db: AsyncSession, current_user_id: str, identifier: str) -> Conversation:
        # find user by email OR username
        res = await db.execute(select(User).where(or_(User.email == identifier, User.username == identifier)))
        other = res.scalar_one_or_none()
        if not other:
            raise ValueError("User not found")

        # check if DM already exists (simple approach: find conversation with exactly these two members)
        # production-grade: keep a deterministic "dm_key" column. (optional upgrade)
        # here: scan using membership join (OK for MVP)
        # -> create new DM if not found
        conv_id = str(uuid.uuid4())
        conv = Conversation(id=conv_id, kind="dm", title=None)
        db.add(conv)
        db.add_all([
            ConversationMember(conversation_id=conv_id, user_id=current_user_id, is_admin=False),
            ConversationMember(conversation_id=conv_id, user_id=other.id, is_admin=False),
        ])
        await db.commit()
        await db.refresh(conv)
        return conv

    @staticmethod
    async def create_group(db: AsyncSession, current_user_id: str, title: str, member_ids: list[str]) -> Conversation:
        conv_id = str(uuid.uuid4())
        conv = Conversation(id=conv_id, kind="group", title=title)
        db.add(conv)

        # creator is admin
        db.add(ConversationMember(conversation_id=conv_id, user_id=current_user_id, is_admin=True))
        for uid in member_ids:
            if uid != current_user_id:
                db.add(ConversationMember(conversation_id=conv_id, user_id=uid, is_admin=False))

        await db.commit()
        await db.refresh(conv)
        return conv
