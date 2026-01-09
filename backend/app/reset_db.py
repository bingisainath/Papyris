# reset_db.py
import asyncio
from app.db.session import AsyncSessionLocal
from app.models.base_class import Base

async def reset():
    async with AsyncSessionLocal() as session:
        # Drop all tables
        await session.run_sync(Base.metadata.drop_all)
        # Recreate tables based on current models
        await session.run_sync(Base.metadata.create_all)

asyncio.run(reset())
print("Database reset complete!")
