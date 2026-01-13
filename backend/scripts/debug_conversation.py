# scripts/debug_conversation.py
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = "postgresql+asyncpg://papyris:papyris_dev@localhost:5432/papyris"
engine = create_async_engine(DATABASE_URL, echo=False)

CONVERSATION_ID = "PUT_UUID_HERE"

async def main():
    async with engine.connect() as conn:
        print("👥 Conversation Members")
        members = await conn.execute(text("""
            SELECT u.id, u.name, u.email
            FROM conversation_members cm
            JOIN users u ON u.id = cm.user_id
            WHERE cm.conversation_id = :cid;
        """), {"cid": CONVERSATION_ID})

        for row in members.fetchall():
            print(dict(row._mapping))

        print("\n💬 Messages")
        messages = await conn.execute(text("""
            SELECT id, sender_id, content, created_at
            FROM messages
            WHERE conversation_id = :cid
            ORDER BY created_at DESC
            LIMIT 10;
        """), {"cid": CONVERSATION_ID})

        for row in messages.fetchall():
            print(dict(row._mapping))

asyncio.run(main())
