import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = "postgresql+asyncpg://papyris:papyris_dev@localhost:5432/papyris"

engine = create_async_engine(DATABASE_URL, echo=False)

async def main():
    async with engine.connect() as conn:
        # Get all tables
        result = await conn.execute(
            text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public';
            """)
        )
        tables = [row[0] for row in result.fetchall()]
        print("Tables in DB:", tables)

        # For each table, get columns
        for table in tables:
            result = await conn.execute(
                text(f"""
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_name = '{table}';
                """)
            )
            columns = result.fetchall()
            print(f"\nTable '{table}' columns:")
            for col in columns:
                print(f" - {col[0]} ({col[1]})")

asyncio.run(main())
