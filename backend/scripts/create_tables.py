"""
Create Database Tables - Python Script
Run this instead of psql when you don't have PostgreSQL client installed
"""

import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text
from app.db.session import engine
from app.db.base import Base

# Import all models so they're registered with Base
from app.models.user import User
from app.models.conversation import Conversation
from app.models.conversation_member import ConversationMember
from app.models.message_receipt import MessageReceipt

# Import Message model (create this file if it doesn't exist yet)
try:
    from app.models.message import Message
    print("✅ Message model imported")
except ImportError:
    print("⚠️  Message model not found - will create table schema manually")
    Message = None


async def create_tables():
    """Create all database tables"""
    print("🚀 Starting database table creation...\n")
    
    async with engine.begin() as conn:
        # Drop all tables (optional - uncomment if you want fresh start)
        # print("⚠️  Dropping existing tables...")
        # await conn.run_sync(Base.metadata.drop_all)
        # print("✅ Dropped all tables\n")
        
        # Create all tables
        print("📦 Creating tables from models...")
        await conn.run_sync(Base.metadata.create_all)
        print("✅ Created tables from models\n")
        
        # If Message model doesn't exist, create the table manually
        if Message is None:
            print("📝 Creating messages table manually...")
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS messages (
                    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    conversation_id VARCHAR NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    text TEXT NOT NULL,
                    media_url VARCHAR,
                    status VARCHAR NOT NULL DEFAULT 'sent',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    deleted_at TIMESTAMPTZ
                )
            """))
            
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_messages_conversation 
                ON messages(conversation_id)
            """))
            
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_messages_created_at 
                ON messages(created_at)
            """))
            
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
                ON messages(conversation_id, created_at)
            """))
            
            print("✅ Messages table created manually\n")
        
        # Verify tables
        print("🔍 Verifying tables...")
        result = await conn.execute(text("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        """))
        
        tables = result.fetchall()
        
        if tables:
            print("✅ Found tables:")
            for table in tables:
                print(f"   - {table[0]}")
        else:
            print("❌ No tables found!")
            return False
        
        print()
        
        # Check table details
        print("📊 Table details:")
        for table in tables:
            count_result = await conn.execute(text(f"SELECT COUNT(*) FROM {table[0]}"))
            count = count_result.scalar()
            print(f"   {table[0]}: {count} rows")
        
        return True


async def test_connection():
    """Test database connection"""
    print("🔌 Testing database connection...")
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✅ Connected to PostgreSQL")
            print(f"   Version: {version[:50]}...")
            return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False


async def main():
    """Main execution"""
    print("=" * 60)
    print("PAPYRIS DATABASE SETUP")
    print("=" * 60)
    print()
    
    # Test connection
    if not await test_connection():
        print("\n❌ Cannot connect to database. Check:")
        print("   1. udocker containers are running: udocker ps")
        print("   2. DATABASE_URL in .env is correct")
        print("   3. PostgreSQL is accessible on localhost:5432")
        return
    
    print()
    
    # Create tables
    success = await create_tables()
    
    print()
    print("=" * 60)
    if success:
        print("✅ DATABASE SETUP COMPLETE!")
        print("=" * 60)
        print()
        print("Next steps:")
        print("1. Create app/models/message.py (if not exists)")
        print("2. Create app/websocket/streams.py")
        print("3. Create app/worker.py")
        print("4. Start backend: uvicorn app.main:app --reload")
        print("5. Test: curl http://localhost:8000/health")
    else:
        print("❌ DATABASE SETUP FAILED")
        print("=" * 60)
    print()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Setup interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Setup failed with error: {e}")
        import traceback
        traceback.print_exc()
