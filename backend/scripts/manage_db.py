#!/usr/bin/env python3
"""
Database Management Script for Papyris
Handles: Reset, Check, View Data, Add Missing Columns

Usage:
    python scripts/manage_db.py check           # Check database structure
    python scripts/manage_db.py reset           # Reset database (WARNING: Deletes all data)
    python scripts/manage_db.py add-columns     # Add missing columns to existing tables
    python scripts/manage_db.py view [table]    # View table data
"""

import sys
import os
import asyncio
from sqlalchemy import text

# Add parent directory to path so app imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def get_engine():
    """Always use the app's engine - it already has the correct RDS connection."""
    from app.db.session import engine
    return engine


async def check_database():
    """Check current database structure"""
    engine = get_engine()

    async with engine.connect() as conn:
        print("🔍 Checking database structure...\n")

        result = await conn.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' ORDER BY table_name
        """))
        tables = [row[0] for row in result.fetchall()]

        print(f"📊 Found {len(tables)} tables: {', '.join(tables)}\n")

        required_tables = [
            'users', 'conversations', 'messages', 'conversation_members',
            'message_receipts', 'blocked_users', 'group_settings'
        ]

        print("✅ Required Tables Status:")
        missing_tables = []
        for table in required_tables:
            if table in tables:
                print(f"   ✓ {table}")
            else:
                print(f"   ✗ {table} (MISSING)")
                missing_tables.append(table)

        if missing_tables:
            print(f"\n⚠️  Missing: {', '.join(missing_tables)}")

        # Check messages columns specifically
        if 'messages' in tables:
            result = await conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'messages' ORDER BY ordinal_position
            """))
            msg_cols = [r[0] for r in result.fetchall()]
            required_msg_cols = ['reactions', 'is_edited', 'edited_at', 'is_deleted', 'deleted_at']
            print(f"\n📋 messages columns ({len(msg_cols)} total):")
            for col in required_msg_cols:
                status = "✓" if col in msg_cols else "✗ MISSING"
                print(f"   {status} {col}")

        print("\n📋 All table column counts:")
        for table in sorted(tables):
            result = await conn.execute(text(f"""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_name = '{table}'
            """))
            count = result.scalar()
            print(f"   {table}: {count} columns")


async def add_missing_columns():
    """Safely add any missing columns to existing tables without dropping data."""
    engine = get_engine()

    async with engine.begin() as conn:
        print("🔧 Adding missing columns...\n")

        # Define all ALTER TABLE statements - all use IF NOT EXISTS so safe to re-run
        alterations = [
            # messages - the main culprit
            ("messages", "reactions",  "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '{}'"),
            ("messages", "is_edited",  "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT FALSE"),
            ("messages", "edited_at",  "ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ"),
            ("messages", "is_deleted", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE"),
            ("messages", "deleted_at", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ"),
            # users - extra profile fields
            ("users", "bio",       "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(500)"),
            ("users", "is_online", "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE"),
            ("users", "last_seen", "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ"),
        ]

        for table, col, sql in alterations:
            try:
                await conn.execute(text(sql))
                print(f"   ✅ {table}.{col}")
            except Exception as e:
                print(f"   ⚠️  {table}.{col}: {str(e)[:80]}")

        # Create missing tables
        tables_sql = {
            "blocked_users": """
                CREATE TABLE IF NOT EXISTS blocked_users (
                    id         SERIAL PRIMARY KEY,
                    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT unique_blocker_blocked UNIQUE (blocker_id, blocked_id)
                )""",
            "group_settings": """
                CREATE TABLE IF NOT EXISTS group_settings (
                    id                          SERIAL PRIMARY KEY,
                    conversation_id             UUID NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
                    only_admins_can_message     BOOLEAN NOT NULL DEFAULT FALSE,
                    only_admins_can_add_members BOOLEAN NOT NULL DEFAULT TRUE,
                    send_message_notification   BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )""",
        }

        for table, sql in tables_sql.items():
            try:
                await conn.execute(text(sql))
                print(f"   ✅ {table} table ensured")
            except Exception as e:
                print(f"   ⚠️  {table}: {str(e)[:80]}")

        # GIN index for reactions if not exists
        try:
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_message_reactions
                ON messages USING gin(reactions)
            """))
            print("   ✅ GIN index on messages.reactions")
        except Exception as e:
            print(f"   ⚠️  GIN index: {str(e)[:80]}")

        print("\n✅ Done! Restart your backend now.")


async def reset_database():
    """Drop and recreate ALL tables from scratch using the app engine."""
    engine = get_engine()

    print("⚠️  WARNING: This will DELETE ALL DATA in the database!")
    response = input("Type 'yes' to continue: ")
    if response.lower() != 'yes':
        print("❌ Cancelled")
        return

    async with engine.begin() as conn:
        print("\n🗑  Dropping tables in safe order...")
        drops = [
            "DROP TABLE IF EXISTS message_receipts CASCADE",
            "DROP TABLE IF EXISTS messages CASCADE",
            "DROP TABLE IF EXISTS group_settings CASCADE",
            "DROP TABLE IF EXISTS conversation_members CASCADE",
            "DROP TABLE IF EXISTS conversations CASCADE",
            "DROP TABLE IF EXISTS blocked_users CASCADE",
            "DROP TABLE IF EXISTS users CASCADE",
            "DROP TYPE IF EXISTS message_type_enum CASCADE",
            "DROP TYPE IF EXISTS member_role_enum CASCADE",
            "DROP TYPE IF EXISTS receipt_status_enum CASCADE",
            "DROP TYPE IF EXISTS gender_enum CASCADE",
            "DROP TYPE IF EXISTS user_status_enum CASCADE",
        ]
        for sql in drops:
            try:
                await conn.execute(text(sql))
                print(f"   🗑  {sql[:55]}")
            except Exception as e:
                print(f"   ⚠️  {sql[:55]}: {str(e)[:60]}")

        print("\n📦 Creating enum types...")
        enums = [
            "DO $$ BEGIN CREATE TYPE gender_enum AS ENUM ('male','female','other',''); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
            "DO $$ BEGIN CREATE TYPE user_status_enum AS ENUM ('active','inactive','suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
            "DO $$ BEGIN CREATE TYPE message_type_enum AS ENUM ('text','image','video','file','audio','system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
            "DO $$ BEGIN CREATE TYPE member_role_enum AS ENUM ('admin','moderator','member','viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
            "DO $$ BEGIN CREATE TYPE receipt_status_enum AS ENUM ('sent','delivered','read'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
        ]
        for sql in enums:
            await conn.execute(text(sql))
        print("   ✅ Enums created")

        print("\n📦 Creating tables...")

        await conn.execute(text("""
            CREATE TABLE users (
                id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username         VARCHAR(50)  NOT NULL UNIQUE,
                email            VARCHAR(255) NOT NULL UNIQUE,
                hashed_password  VARCHAR      NOT NULL,
                name             VARCHAR(100),
                phone            VARCHAR(20),
                date_of_birth    TIMESTAMP,
                gender           gender_enum  DEFAULT '',
                address          TEXT,
                bio              VARCHAR(500),
                avatar           VARCHAR,
                google_id        VARCHAR UNIQUE,
                facebook_id      VARCHAR UNIQUE,
                is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
                status           user_status_enum DEFAULT 'active',
                reset_token      VARCHAR(255),
                reset_token_expires TIMESTAMPTZ,
                created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                last_login       TIMESTAMPTZ,
                is_online        BOOLEAN      NOT NULL DEFAULT FALSE,
                last_seen        TIMESTAMPTZ
            )
        """))
        print("   ✅ users")

        await conn.execute(text("""
            CREATE TABLE blocked_users (
                id         SERIAL PRIMARY KEY,
                blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT unique_blocker_blocked UNIQUE (blocker_id, blocked_id)
            )
        """))
        print("   ✅ blocked_users")

        await conn.execute(text("""
            CREATE TABLE conversations (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                kind        VARCHAR(10)  NOT NULL,
                title       VARCHAR(255),
                description VARCHAR(500),
                avatar_url  VARCHAR(500) NOT NULL DEFAULT '',
                created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
                is_archived BOOLEAN      NOT NULL DEFAULT FALSE,
                created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            )
        """))
        print("   ✅ conversations")

        await conn.execute(text("""
            CREATE TABLE group_settings (
                id                          SERIAL PRIMARY KEY,
                conversation_id             UUID NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
                only_admins_can_message     BOOLEAN NOT NULL DEFAULT FALSE,
                only_admins_can_add_members BOOLEAN NOT NULL DEFAULT TRUE,
                send_message_notification   BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        print("   ✅ group_settings")

        await conn.execute(text("""
            CREATE TABLE messages (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                message_type    message_type_enum NOT NULL DEFAULT 'text',
                text            TEXT NOT NULL DEFAULT '',
                media_url       VARCHAR(500),
                media_thumbnail VARCHAR(500),
                media_size      INTEGER,
                media_filename  VARCHAR(255),
                reply_to_id     UUID REFERENCES messages(id) ON DELETE SET NULL,
                reactions       JSONB NOT NULL DEFAULT '{}',
                is_edited       BOOLEAN NOT NULL DEFAULT FALSE,
                edited_at       TIMESTAMPTZ,
                is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
                deleted_at      TIMESTAMPTZ,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ
            )
        """))
        print("   ✅ messages")

        await conn.execute(text("""
            CREATE TABLE conversation_members (
                id                   SERIAL PRIMARY KEY,
                conversation_id      UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role                 member_role_enum NOT NULL DEFAULT 'member',
                can_send_messages    BOOLEAN NOT NULL DEFAULT TRUE,
                last_read_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
                last_read_at         TIMESTAMPTZ,
                muted                BOOLEAN NOT NULL DEFAULT FALSE,
                joined_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_conversation_user UNIQUE (conversation_id, user_id)
            )
        """))
        print("   ✅ conversation_members")

        await conn.execute(text("""
            CREATE TABLE message_receipts (
                id           SERIAL PRIMARY KEY,
                message_id   UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
                user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status       receipt_status_enum NOT NULL DEFAULT 'sent',
                delivered_at TIMESTAMPTZ,
                read_at      TIMESTAMPTZ,
                created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_message_user_receipt UNIQUE (message_id, user_id)
            )
        """))
        print("   ✅ message_receipts")

        print("\n📦 Creating indexes...")
        indexes = [
            "CREATE INDEX idx_conversation_kind    ON conversations(kind)",
            "CREATE INDEX idx_conversation_updated ON conversations(updated_at)",
            "CREATE INDEX idx_message_conversation ON messages(conversation_id)",
            "CREATE INDEX idx_message_sender       ON messages(sender_id)",
            "CREATE INDEX idx_message_created      ON messages(created_at)",
            "CREATE INDEX idx_message_reactions    ON messages USING gin(reactions)",
            "CREATE INDEX idx_member_conversation  ON conversation_members(conversation_id)",
            "CREATE INDEX idx_member_user          ON conversation_members(user_id)",
            "CREATE INDEX idx_receipt_message      ON message_receipts(message_id)",
            "CREATE INDEX idx_receipt_user         ON message_receipts(user_id)",
            "CREATE INDEX ix_blocked_users_blocker ON blocked_users(blocker_id)",
            "CREATE INDEX ix_blocked_users_blocked ON blocked_users(blocked_id)",
        ]
        for sql in indexes:
            await conn.execute(text(sql))
        print("   ✅ All indexes created")

    print("\n🎉 Database reset complete! Restart your backend.")


async def view_table_data(table_name=None):
    """View data from specified table or all tables"""
    engine = get_engine()

    async with engine.connect() as conn:
        result = await conn.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' ORDER BY table_name
        """))
        all_tables = [row[0] for row in result.fetchall()]
        tables_to_view = [table_name] if table_name else all_tables

        for table in tables_to_view:
            if table not in all_tables:
                print(f"❌ Table '{table}' does not exist")
                continue

            print(f"\n{'='*60}\n📄 Table: {table}\n{'='*60}")
            count_result = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            count = count_result.scalar()
            print(f"Total rows: {count}")

            if count == 0:
                print("⚠️  No data\n")
                continue

            result = await conn.execute(text(f"SELECT * FROM {table} LIMIT 5"))
            rows = result.fetchall()
            columns = result.keys()
            for i, row in enumerate(rows, 1):
                print(f"\nRow {i}:")
                for key, value in zip(columns, row):
                    v = str(value)
                    print(f"  {key}: {v[:60]}{'...' if len(v) > 60 else ''}")
            if count > 5:
                print(f"\n... and {count - 5} more rows")


def print_usage():
    print("""
╔════════════════════════════════════════════════════════════╗
║          Papyris Database Management Tool                  ║
╚════════════════════════════════════════════════════════════╝

Commands:
    check           Check database structure and missing columns
    add-columns     Safely add missing columns (no data loss)
    reset           Full drop + recreate (DELETES ALL DATA)
    view [table]    View table data

Examples:
    python scripts/manage_db.py check
    python scripts/manage_db.py add-columns     ← use this first!
    python scripts/manage_db.py reset
    python scripts/manage_db.py view users
""")


async def main():
    if len(sys.argv) < 2:
        print_usage()
        return

    command = sys.argv[1].lower()

    try:
        if command == 'check':
            await check_database()
        elif command == 'add-columns':
            await add_missing_columns()
        elif command == 'reset':
            await reset_database()
        elif command == 'view':
            table = sys.argv[2] if len(sys.argv) > 2 else None
            await view_table_data(table)
        else:
            print(f"❌ Unknown command: {command}\n")
            print_usage()
    except KeyboardInterrupt:
        print("\n⚠️  Cancelled")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())