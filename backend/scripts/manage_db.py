#!/usr/bin/env python3
"""
Database Management Script for Papyris
Handles: Reset, Check, View Data, Add Missing Tables

Usage:
    python scripts/manage_db.py check           # Check database structure
    python scripts/manage_db.py reset           # Reset database (WARNING: Deletes all data)
    python scripts/manage_db.py add-tables      # Add missing tables only
    python scripts/manage_db.py view [table]    # View table data
"""

import sys
import os
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Add parent directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Database configuration
DATABASE_URL = os.getenv('DATABASE_URL', "postgresql+asyncpg://papyris:papyris_dev@localhost:5432/papyris")

async def check_database():
    """Check current database structure"""
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.connect() as conn:
        print("🔍 Checking database structure...\n")
        
        # Get all tables
        result = await conn.execute(
            text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """)
        )
        tables = [row[0] for row in result.fetchall()]
        
        print(f"📊 Found {len(tables)} tables:\n")
        print("Tables:", ", ".join(tables))
        
        # Check for required tables
        required_tables = ['users', 'conversations', 'messages', 'conversation_members', 
                          'message_receipts', 'blocked_users', 'group_settings']
        
        print("\n✅ Required Tables Status:")
        missing_tables = []
        for table in required_tables:
            if table in tables:
                print(f"   ✓ {table}")
            else:
                print(f"   ✗ {table} (MISSING)")
                missing_tables.append(table)
        
        if missing_tables:
            print(f"\n⚠️  Missing tables: {', '.join(missing_tables)}")
            print("   Run: python scripts/manage_db.py add-tables")
        else:
            print("\n✅ All required tables exist!")
        
        # Show column details for each table
        print("\n📋 Table Structures:")
        for table in sorted(tables):
            result = await conn.execute(
                text(f"""
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_name = '{table}'
                    ORDER BY ordinal_position;
                """)
            )
            columns = result.fetchall()
            print(f"\n  {table} ({len(columns)} columns):")
            for col in columns[:5]:  # Show first 5 columns
                nullable = "NULL" if col[2] == 'YES' else "NOT NULL"
                print(f"    - {col[0]}: {col[1]} ({nullable})")
            if len(columns) > 5:
                print(f"    ... and {len(columns) - 5} more columns")
    
    await engine.dispose()


async def add_missing_tables():
    """Add blocked_users and group_settings tables if they don't exist"""
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        print("🔧 Adding missing tables...\n")
        
        # Check which tables exist
        result = await conn.execute(
            text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name IN ('blocked_users', 'group_settings');
            """)
        )
        existing_tables = [row[0] for row in result.fetchall()]
        
        # Create blocked_users table
        if 'blocked_users' not in existing_tables:
            print("📦 Creating blocked_users table...")
            await conn.execute(text("""
                CREATE TABLE blocked_users (
                    id SERIAL PRIMARY KEY,
                    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    CONSTRAINT unique_blocker_blocked UNIQUE (blocker_id, blocked_id)
                );
            """))
            
            await conn.execute(text("""
                CREATE INDEX ix_blocked_users_blocker_id ON blocked_users(blocker_id);
            """))
            
            await conn.execute(text("""
                CREATE INDEX ix_blocked_users_blocked_id ON blocked_users(blocked_id);
            """))
            
            print("   ✅ blocked_users table created")
        else:
            print("   ℹ️  blocked_users table already exists")
        
        # Create group_settings table
        if 'group_settings' not in existing_tables:
            print("📦 Creating group_settings table...")
            await conn.execute(text("""
                CREATE TABLE group_settings (
                    id SERIAL PRIMARY KEY,
                    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                    only_admins_can_message BOOLEAN DEFAULT FALSE NOT NULL,
                    only_admins_can_add_members BOOLEAN DEFAULT TRUE NOT NULL,
                    send_message_notification BOOLEAN DEFAULT TRUE NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    CONSTRAINT unique_conversation_settings UNIQUE (conversation_id)
                );
            """))
            
            await conn.execute(text("""
                CREATE INDEX ix_group_settings_conversation_id ON group_settings(conversation_id);
            """))
            
            print("   ✅ group_settings table created")
        else:
            print("   ℹ️  group_settings table already exists")
        
        # Add bio column to users if missing
        print("📦 Checking users.bio column...")
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'bio';
        """))
        
        if not result.fetchone():
            await conn.execute(text("""
                ALTER TABLE users ADD COLUMN bio VARCHAR(500);
            """))
            print("   ✅ Added bio column to users")
        else:
            print("   ℹ️  bio column already exists")
        
        print("\n✅ All required tables are now present!")
    
    await engine.dispose()


async def reset_database():
    """Reset database by dropping and recreating all tables"""
    try:
        # Import models
        from app.db.base import Base
        from app.db.session import engine
        from app.models.user import User
        from app.models.conversation import Conversation
        from app.models.conversation_member import ConversationMember
        from app.models.message_receipt import MessageReceipt
        from app.models.message import Message
        
        print("⚠️  WARNING: This will DELETE ALL DATA in the database!")
        response = input("Are you sure you want to continue? (yes/no): ")
        
        if response.lower() != 'yes':
            print("❌ Reset cancelled")
            return
        
        async with engine.begin() as conn:
            print("\n🗑️  Dropping all tables...")
            await conn.run_sync(Base.metadata.drop_all)
            print("   ✅ Tables dropped")
            
            print("\n📦 Creating tables from models...")
            await conn.run_sync(Base.metadata.create_all)
            print("   ✅ Tables created from models")
            
            # Ensure avatar column exists
            await conn.execute(text("""
                ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR;
            """))
            print("   ✅ avatar column ensured")
        
        print("\n✅ Database reset complete!")
        print("\n⚠️  Don't forget to run: python scripts/manage_db.py add-tables")
        
    except ImportError as e:
        print(f"❌ Error importing models: {e}")
        print("   Make sure you're running from the backend directory")
        return


async def view_table_data(table_name=None):
    """View data from specified table or all tables"""
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.connect() as conn:
        # Get list of tables
        result = await conn.execute(
            text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """)
        )
        all_tables = [row[0] for row in result.fetchall()]
        
        tables_to_view = [table_name] if table_name else all_tables
        
        for table in tables_to_view:
            if table not in all_tables:
                print(f"❌ Table '{table}' does not exist")
                continue
            
            print(f"\n{'='*60}")
            print(f"📄 Table: {table}")
            print('='*60)
            
            try:
                # Get row count
                count_result = await conn.execute(
                    text(f"SELECT COUNT(*) FROM {table};")
                )
                count = count_result.scalar()
                print(f"Total rows: {count}")
                
                if count == 0:
                    print("⚠️  No data in this table\n")
                    continue
                
                # Get data
                result = await conn.execute(
                    text(f"SELECT * FROM {table} LIMIT 5;")
                )
                rows = result.fetchall()
                columns = result.keys()
                
                print(f"\nShowing first {min(5, count)} rows:")
                print("-" * 60)
                
                for i, row in enumerate(rows, 1):
                    print(f"\nRow {i}:")
                    row_dict = dict(zip(columns, row))
                    for key, value in row_dict.items():
                        # Truncate long values
                        if isinstance(value, str) and len(value) > 50:
                            value = value[:47] + "..."
                        print(f"  {key}: {value}")
                
                if count > 5:
                    print(f"\n... and {count - 5} more rows")
                
            except Exception as e:
                print(f"❌ Error reading {table}: {e}")
    
    await engine.dispose()


def print_usage():
    """Print usage instructions"""
    print("""
╔════════════════════════════════════════════════════════════╗
║          Papyris Database Management Tool                  ║
╚════════════════════════════════════════════════════════════╝

Usage:
    python scripts/manage_db.py <command> [options]

Commands:
    check           Check database structure and missing tables
    add-tables      Add blocked_users and group_settings tables
    reset           Reset database (WARNING: Deletes all data!)
    view [table]    View data from table (or all tables if not specified)

Examples:
    python scripts/manage_db.py check
    python scripts/manage_db.py add-tables
    python scripts/manage_db.py view users
    python scripts/manage_db.py reset

Environment:
    DATABASE_URL    Database connection string (optional)
                    Default: postgresql+asyncpg://papyris:papyris_dev@localhost:5432/papyris
""")


async def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print_usage()
        return
    
    command = sys.argv[1].lower()
    
    try:
        if command == 'check':
            await check_database()
        
        elif command == 'add-tables':
            await add_missing_tables()
        
        elif command == 'reset':
            await reset_database()
        
        elif command == 'view':
            table = sys.argv[2] if len(sys.argv) > 2 else None
            await view_table_data(table)
        
        else:
            print(f"❌ Unknown command: {command}\n")
            print_usage()
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Operation cancelled by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())