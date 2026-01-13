# scripts/view_table_data.py
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = "postgresql+asyncpg://papyris:papyris_dev@localhost:5432/papyris"
engine = create_async_engine(DATABASE_URL, echo=False)

TABLES_TO_CHECK = ["users", "conversations", "messages"]
LIMIT = 5

async def main():
    async with engine.connect() as conn:
        for table in TABLES_TO_CHECK:
            print(f"\n📄 Table: {table}")
            print("-" * 40)

            try:
                result = await conn.execute(
                    text(f"SELECT * FROM {table} LIMIT {LIMIT};")
                )
                rows = result.fetchall()

                if not rows:
                    print("⚠️ No data found")
                    continue

                for row in rows:
                    print(dict(row._mapping))

            except Exception as e:
                print(f"❌ Error reading {table}: {e}")

asyncio.run(main())
