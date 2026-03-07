"""
Run this from backend/ directory:
    venv/Scripts/python.exe migrate_via_app.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.session import async_session_maker

DROPS = [
    "DROP TABLE IF EXISTS message_receipts CASCADE",
    "DROP TABLE IF EXISTS messages CASCADE",
    "DROP TABLE IF EXISTS group_settings CASCADE",
    "DROP TABLE IF EXISTS conversation_members CASCADE",
    "DROP TABLE IF EXISTS conversations CASCADE",
]

ENUM_DROPS = [
    "DROP TYPE IF EXISTS message_type_enum CASCADE",
    "DROP TYPE IF EXISTS receipt_status_enum CASCADE",
    "DROP TYPE IF EXISTS member_role_enum CASCADE",
]

CREATES = [
    # enums
    """DO $$ BEGIN
        CREATE TYPE message_type_enum AS ENUM ('text','image','video','file','audio','system');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$""",

    """DO $$ BEGIN
        CREATE TYPE member_role_enum AS ENUM ('admin','moderator','member','viewer');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$""",

    """DO $$ BEGIN
        CREATE TYPE receipt_status_enum AS ENUM ('sent','delivered','read');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$""",

    # conversations
    """CREATE TABLE conversations (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kind        VARCHAR(10)  NOT NULL,
        title       VARCHAR(255),
        description VARCHAR(500),
        avatar_url  VARCHAR(500) NOT NULL DEFAULT '',
        created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        is_archived BOOLEAN      NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX idx_conversation_kind    ON conversations(kind)",
    "CREATE INDEX idx_conversation_updated ON conversations(updated_at)",

    # group_settings
    """CREATE TABLE group_settings (
        id                          SERIAL PRIMARY KEY,
        conversation_id             UUID NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
        only_admins_can_message     BOOLEAN NOT NULL DEFAULT FALSE,
        only_admins_can_add_members BOOLEAN NOT NULL DEFAULT TRUE,
        send_message_notification   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",

    # messages
    """CREATE TABLE messages (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id       UUID NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
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
    )""",
    "CREATE INDEX idx_message_conversation ON messages(conversation_id)",
    "CREATE INDEX idx_message_sender       ON messages(sender_id)",
    "CREATE INDEX idx_message_created      ON messages(created_at)",
    "CREATE INDEX idx_message_reactions    ON messages USING gin(reactions)",

    # conversation_members
    """CREATE TABLE conversation_members (
        id                   SERIAL PRIMARY KEY,
        conversation_id      UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id              UUID NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
        role                 member_role_enum NOT NULL DEFAULT 'member',
        can_send_messages    BOOLEAN NOT NULL DEFAULT TRUE,
        last_read_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
        last_read_at         TIMESTAMPTZ,
        muted                BOOLEAN NOT NULL DEFAULT FALSE,
        joined_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_conversation_user UNIQUE (conversation_id, user_id)
    )""",
    "CREATE INDEX idx_member_conversation ON conversation_members(conversation_id)",
    "CREATE INDEX idx_member_user         ON conversation_members(user_id)",

    # message_receipts
    """CREATE TABLE message_receipts (
        id           SERIAL PRIMARY KEY,
        message_id   UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id      UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
        status       receipt_status_enum NOT NULL DEFAULT 'sent',
        delivered_at TIMESTAMPTZ,
        read_at      TIMESTAMPTZ,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_message_user_receipt UNIQUE (message_id, user_id)
    )""",
    "CREATE INDEX idx_receipt_message ON message_receipts(message_id)",
    "CREATE INDEX idx_receipt_user    ON message_receipts(user_id)",
]


async def main():
    async with async_session_maker() as db:
        print("✅ Connected via app session")

        # Drop tables
        for sql in DROPS:
            await db.execute(text(sql))
            print(f"🗑  {sql[:55]}")

        # Drop old enums
        for sql in ENUM_DROPS:
            try:
                await db.execute(text(sql))
            except Exception:
                pass

        await db.commit()
        print("✅ Drops committed")

        # Create everything
        for sql in CREATES:
            await db.execute(text(sql))
            label = sql.strip().splitlines()[0][:60]
            print(f"✅ {label}")

        await db.commit()
        print("\n🎉 All tables recreated! Restart your backend now.")


asyncio.run(main())