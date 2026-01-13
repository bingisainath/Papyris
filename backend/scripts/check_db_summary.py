import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# scripts/check_db_summary.py
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = "postgresql+asyncpg://papyris:papyris_dev@localhost:5432/papyris"

engine = create_async_engine(DATABASE_URL, echo=False)

async def main():
    async with engine.connect() as conn:
        result = await conn.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public';
        """))
        tables = [row[0] for row in result.fetchall()]

        print("📦 Tables and row counts:\n")
        for table in tables:
            count_result = await conn.execute(
                text(f"SELECT COUNT(*) FROM {table};")
            )
            count = count_result.scalar()
            print(f" - {table}: {count} rows")

asyncio.run(main())
