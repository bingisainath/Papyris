"""
Verify Database Tables - Quick Check Script
"""
import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text
from app.db.session import engine


async def verify():
    """Verify database setup"""
    print("=" * 60)
    print("DATABASE VERIFICATION")
    print("=" * 60)
    print()
    
    try:
        async with engine.connect() as conn:
            # Test connection
            print("🔌 Testing connection...")
            await conn.execute(text("SELECT 1"))
            print("✅ Connected to database\n")
            
            # List tables
            print("📊 Tables in database:")
            result = await conn.execute(text("""
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public'
                ORDER BY tablename
            """))
            tables = result.fetchall()
            
            if not tables:
                print("❌ No tables found!")
                print("\nRun: python create_tables.py")
                return False
            
            for table in tables:
                print(f"   ✅ {table[0]}")
            
            print()
            
            # Count rows
            print("📈 Table row counts:")
            for table in tables:
                count_result = await conn.execute(
                    text(f"SELECT COUNT(*) FROM {table[0]}")
                )
                count = count_result.scalar()
                print(f"   {table[0]}: {count} rows")
            
            print()
            
            # Check expected tables
            expected = {'users', 'conversations', 'conversation_members', 
                       'messages', 'message_receipts'}
            found = {t[0] for t in tables}
            
            missing = expected - found
            if missing:
                print(f"⚠️  Missing tables: {', '.join(missing)}")
                return False
            
            print("✅ All required tables present!")
            print()
            
            return True
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


async def main():
    success = await verify()
    
    print("=" * 60)
    if success:
        print("✅ DATABASE IS READY!")
        print("=" * 60)
        print()
        print("Next steps:")
        print("1. Start backend: uvicorn app.main:app --reload")
        print("2. Test auth: curl http://localhost:8000/api/v1/auth/ping")
    else:
        print("❌ DATABASE SETUP INCOMPLETE")
        print("=" * 60)
        print()
        print("To fix:")
        print("1. Run: python create_tables.py")
        print("2. Check DATABASE_URL in .env")
        print("3. Verify udocker containers: udocker ps")
    print()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"\n❌ Verification failed: {e}")
