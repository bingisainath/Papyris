# # reset_db.py
# import asyncio
# from app.db.base import Base          # Correct import
# from app.db.session import engine     # Your AsyncEngine

# async def reset():
#     async with engine.begin() as conn:
#         await conn.run_sync(Base.metadata.drop_all)   # drop all tables
#         await conn.run_sync(Base.metadata.create_all) # recreate all tables
#     print("Database reset complete.")

# if __name__ == "__main__":
#     asyncio.run(reset())


import asyncio
from sqlalchemy import text
from app.db.base import Base
from app.db.session import engine

# Import all models so metadata includes all columns
from app.models.user import User
from app.models.conversation import Conversation
from app.models.conversation_member import ConversationMember
from app.models.message_receipt import MessageReceipt
try:
    from app.models.message import Message
except ImportError:
    Message = None

async def reset():
    async with engine.begin() as conn:
        print("⚠️ Dropping all tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("✅ Tables dropped")
        
        print("📦 Creating tables from models...")
        await conn.run_sync(Base.metadata.create_all)
        print("✅ Tables created")

        # Optional: ensure avatar column exists
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR;"))
        print("✅ avatar column ensured")

    print("Database reset complete.")

if __name__ == "__main__":
    asyncio.run(reset())
