#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║           PAPYRIS - Database Manager (AWS RDS)               ║
╚══════════════════════════════════════════════════════════════╝

Usage:
    python db_manager.py ping              # Test AWS RDS connection
    python db_manager.py status            # Full DB health check
    python db_manager.py tables            # List tables + row counts
    python db_manager.py create-tables     # Create all missing tables
    python db_manager.py reset             # Drop & recreate all tables (⚠️ destructive)
    python db_manager.py view <table>      # View rows in a table
    python db_manager.py fix-ip            # Show how to whitelist your IP in AWS
    python db_manager.py help              # Show this help

Set DATABASE_URL env var or edit DEFAULT_DB_URL below.
"""

import sys
import os
import asyncio
import socket
import urllib.request
from datetime import datetime

# ─────────────────────────────────────────────
# CONFIG — edit this or set DATABASE_URL in .env
# ─────────────────────────────────────────────
DEFAULT_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:password@your-rds-endpoint.rds.amazonaws.com:5432/papyris"
)

# Required tables for Papyris
REQUIRED_TABLES = [
    "users",
    "conversations",
    "conversation_members",
    "messages",
    "message_receipts",
    "blocked_users",
    "group_settings",
]

# ─────────────────────────────────────────────
# COLORS
# ─────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def ok(msg):   print(f"{GREEN}  ✅ {msg}{RESET}")
def err(msg):  print(f"{RED}  ❌ {msg}{RESET}")
def warn(msg): print(f"{YELLOW}  ⚠️  {msg}{RESET}")
def info(msg): print(f"{CYAN}  ℹ️  {msg}{RESET}")
def sep():     print(f"\n{'─' * 62}\n")


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def parse_rds_host(db_url: str) -> tuple[str, int]:
    """Extract host and port from DATABASE_URL."""
    try:
        # postgresql+asyncpg://user:pass@host:port/db
        after_at = db_url.split("@")[-1]
        host_port = after_at.split("/")[0]
        if ":" in host_port:
            host, port = host_port.split(":")
            return host.strip(), int(port.strip())
        return host_port.strip(), 5432
    except Exception:
        return "unknown", 5432


def get_my_public_ip() -> str:
    try:
        with urllib.request.urlopen("https://api.ipify.org", timeout=5) as r:
            return r.read().decode()
    except Exception:
        return "could not determine"


def tcp_ping(host: str, port: int, timeout: int = 5) -> bool:
    """Raw TCP check — tells you if port is reachable before even trying DB."""
    try:
        sock = socket.create_connection((host, port), timeout=timeout)
        sock.close()
        return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def make_engine(db_url: str):
    try:
        from sqlalchemy.ext.asyncio import create_async_engine
        return create_async_engine(db_url, echo=False, pool_pre_ping=True, connect_args={"ssl": "require"})
    except Exception as e:
        err(f"Could not create engine: {e}")
        sys.exit(1)


# ─────────────────────────────────────────────
# COMMANDS
# ─────────────────────────────────────────────

async def cmd_ping(db_url: str):
    """Quick connectivity check — TCP + DB query."""
    print(f"\n{BOLD}🔌 CONNECTION CHECK{RESET}")
    sep()

    host, port = parse_rds_host(db_url)
    info(f"Target  : {host}:{port}")
    info(f"Your IP : {get_my_public_ip()}")
    print()

    # Step 1: TCP
    print(f"  1. TCP ping to {host}:{port} ...")
    if tcp_ping(host, port):
        ok("Port is reachable (network/firewall OK)")
    else:
        err(f"Cannot reach {host}:{port} — connection timed out")
        print()
        warn("Your IP is probably not whitelisted in the RDS Security Group.")
        print(f"\n{YELLOW}  Run:  python db_manager.py fix-ip{RESET}  for exact AWS instructions.\n")
        return False

    # Step 2: DB auth
    print(f"\n  2. Authenticating to PostgreSQL ...")
    engine = make_engine(db_url)
    try:
        from sqlalchemy import text
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
        ok(f"Authenticated successfully")
        ok(f"PostgreSQL: {version.split(',')[0]}")
        await engine.dispose()
        return True
    except Exception as e:
        err(f"Auth failed: {e}")
        await engine.dispose()
        return False


async def cmd_status(db_url: str):
    """Full health check: connection + tables + row counts."""
    connected = await cmd_ping(db_url)
    if not connected:
        return

    print(f"\n{BOLD}📊 DATABASE STATUS{RESET}")
    sep()

    engine = make_engine(db_url)
    from sqlalchemy import text

    async with engine.connect() as conn:
        # DB name + size
        result = await conn.execute(text("""
            SELECT current_database(),
                   pg_size_pretty(pg_database_size(current_database()))
        """))
        db_name, db_size = result.fetchone()
        ok(f"Database : {db_name}  ({db_size})")

        # Active connections
        result = await conn.execute(text("""
            SELECT count(*) FROM pg_stat_activity WHERE state = 'active'
        """))
        active = result.scalar()
        ok(f"Active connections: {active}")

        # Tables
        result = await conn.execute(text("""
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public' ORDER BY tablename
        """))
        found_tables = [r[0] for r in result.fetchall()]

        print(f"\n  {'Table':<28} {'Rows':>8}  Status")
        print(f"  {'─'*28} {'─'*8}  {'─'*10}")

        missing = []
        for table in REQUIRED_TABLES:
            if table in found_tables:
                count_r = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = count_r.scalar()
                status = f"{GREEN}present{RESET}"
                print(f"  {table:<28} {count:>8}  {status}")
            else:
                missing.append(table)
                print(f"  {table:<28} {'—':>8}  {RED}MISSING{RESET}")

        extra = [t for t in found_tables if t not in REQUIRED_TABLES]
        for table in extra:
            count_r = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            count = count_r.scalar()
            print(f"  {table:<28} {count:>8}  {CYAN}extra{RESET}")

    if missing:
        print()
        warn(f"Missing tables: {', '.join(missing)}")
        info("Run:  python db_manager.py create-tables")
    else:
        print()
        ok("All required tables are present!")

    await engine.dispose()


async def cmd_tables(db_url: str):
    """List all tables with row counts."""
    engine = make_engine(db_url)
    from sqlalchemy import text

    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("""
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public' ORDER BY tablename
            """))
            tables = [r[0] for r in result.fetchall()]

            if not tables:
                warn("No tables found in database.")
                return

            print(f"\n{BOLD}  {'Table':<30} {'Rows':>8}{RESET}")
            print(f"  {'─'*30} {'─'*8}")
            for table in tables:
                count_r = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = count_r.scalar()
                marker = f"{YELLOW}(MISSING){RESET}" if table not in REQUIRED_TABLES else ""
                print(f"  {table:<30} {count:>8}  {marker}")

    except Exception as e:
        err(str(e))
    finally:
        await engine.dispose()


CREATE_TABLES_SQL = """
-- USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    bio VARCHAR(500),
    avatar VARCHAR,
    status VARCHAR(20) DEFAULT 'offline',
    gender VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE NOT NULL,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
CREATE INDEX IF NOT EXISTS ix_users_username ON users(username);

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100),
    is_group BOOLEAN DEFAULT FALSE NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    avatar VARCHAR,
    description VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONVERSATION MEMBERS
CREATE TABLE IF NOT EXISTS conversation_members (
    id SERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' NOT NULL,
    can_send_messages BOOLEAN DEFAULT TRUE NOT NULL,
    last_read_message_id UUID,
    last_read_at TIMESTAMPTZ,
    muted BOOLEAN DEFAULT FALSE NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_conversation_user UNIQUE (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_member_conversation ON conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_member_user ON conversation_members(user_id);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_type VARCHAR(20) DEFAULT 'text' NOT NULL,
    text TEXT,
    media_url VARCHAR(255),
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    reactions JSONB DEFAULT '{}',
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_message_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_created ON messages(created_at);

-- Add FK from conversation_members → messages AFTER messages table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_last_read_message'
    ) THEN
        ALTER TABLE conversation_members
        ADD CONSTRAINT fk_last_read_message
        FOREIGN KEY (last_read_message_id)
        REFERENCES messages(id) ON DELETE SET NULL;
    END IF;
END $$;

-- MESSAGE RECEIPTS
CREATE TABLE IF NOT EXISTS message_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'delivered' NOT NULL,
    delivered_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    CONSTRAINT uq_message_receipt UNIQUE (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_receipt_message ON message_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_receipt_user ON message_receipts(user_id);

-- BLOCKED USERS
CREATE TABLE IF NOT EXISTS blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_blocker_blocked UNIQUE (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocker_id ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_id ON blocked_users(blocked_id);

-- GROUP SETTINGS
CREATE TABLE IF NOT EXISTS group_settings (
    id SERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    only_admins_can_message BOOLEAN DEFAULT FALSE NOT NULL,
    only_admins_can_add_members BOOLEAN DEFAULT TRUE NOT NULL,
    send_message_notification BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_conversation_settings UNIQUE (conversation_id)
);
CREATE INDEX IF NOT EXISTS ix_group_settings_conversation_id ON group_settings(conversation_id);
"""


async def cmd_create_tables(db_url: str):
    """Create all missing tables — one statement at a time (asyncpg requirement)."""
    print(f"\n{BOLD}📦 CREATING TABLES{RESET}")
    sep()

    engine = make_engine(db_url)
    from sqlalchemy import text

    # Each entry is one complete SQL statement to run individually
    INDIVIDUAL_STATEMENTS = [
        # ── USERS ──────────────────────────────────────────────────────
        """CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    bio VARCHAR(500),
    avatar VARCHAR,
    status VARCHAR(20) DEFAULT 'offline',
    gender VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE NOT NULL,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
)""",
        "CREATE INDEX IF NOT EXISTS ix_users_email ON users(email)",
        "CREATE INDEX IF NOT EXISTS ix_users_username ON users(username)",

        # ── CONVERSATIONS ───────────────────────────────────────────────
        """CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100),
    is_group BOOLEAN DEFAULT FALSE NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    avatar VARCHAR,
    description VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
)""",

        # ── CONVERSATION MEMBERS ────────────────────────────────────────
        """CREATE TABLE IF NOT EXISTS conversation_members (
    id SERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' NOT NULL,
    can_send_messages BOOLEAN DEFAULT TRUE NOT NULL,
    last_read_message_id UUID,
    last_read_at TIMESTAMPTZ,
    muted BOOLEAN DEFAULT FALSE NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_conversation_user UNIQUE (conversation_id, user_id)
)""",
        "CREATE INDEX IF NOT EXISTS idx_member_conversation ON conversation_members(conversation_id)",
        "CREATE INDEX IF NOT EXISTS idx_member_user ON conversation_members(user_id)",

        # ── MESSAGES ────────────────────────────────────────────────────
        """CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_type VARCHAR(20) DEFAULT 'text' NOT NULL,
    text TEXT,
    media_url VARCHAR(255),
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    reactions JSONB DEFAULT '{}',
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ
)""",
        "CREATE INDEX IF NOT EXISTS idx_message_conversation ON messages(conversation_id)",
        "CREATE INDEX IF NOT EXISTS idx_message_sender ON messages(sender_id)",
        "CREATE INDEX IF NOT EXISTS idx_message_created ON messages(created_at)",

        # ── FK: conversation_members → messages (added after messages exists) ─
        """DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_last_read_message'
    ) THEN
        ALTER TABLE conversation_members
        ADD CONSTRAINT fk_last_read_message
        FOREIGN KEY (last_read_message_id)
        REFERENCES messages(id) ON DELETE SET NULL;
    END IF;
END $$""",

        # ── MESSAGE RECEIPTS ─────────────────────────────────────────────
        """CREATE TABLE IF NOT EXISTS message_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'delivered' NOT NULL,
    delivered_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    CONSTRAINT uq_message_receipt UNIQUE (message_id, user_id)
)""",
        "CREATE INDEX IF NOT EXISTS idx_receipt_message ON message_receipts(message_id)",
        "CREATE INDEX IF NOT EXISTS idx_receipt_user ON message_receipts(user_id)",

        # ── BLOCKED USERS ────────────────────────────────────────────────
        """CREATE TABLE IF NOT EXISTS blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_blocker_blocked UNIQUE (blocker_id, blocked_id)
)""",
        "CREATE INDEX IF NOT EXISTS idx_blocker_id ON blocked_users(blocker_id)",
        "CREATE INDEX IF NOT EXISTS idx_blocked_id ON blocked_users(blocked_id)",

        # ── GROUP SETTINGS ───────────────────────────────────────────────
        """CREATE TABLE IF NOT EXISTS group_settings (
    id SERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    only_admins_can_message BOOLEAN DEFAULT FALSE NOT NULL,
    only_admins_can_add_members BOOLEAN DEFAULT TRUE NOT NULL,
    send_message_notification BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_conversation_settings UNIQUE (conversation_id)
)""",
        "CREATE INDEX IF NOT EXISTS ix_group_settings_conversation_id ON group_settings(conversation_id)",
    ]

    total = len(INDIVIDUAL_STATEMENTS)
    try:
        async with engine.begin() as conn:
            for i, stmt in enumerate(INDIVIDUAL_STATEMENTS, 1):
                try:
                    await conn.execute(text(stmt))
                    label = stmt.strip().splitlines()[0][:58]
                    ok(f"({i}/{total}) {label}")
                except Exception as e:
                    err(f"Statement {i} failed: {e}")
                    raise
        print()
        ok("All tables created (or already existed)!")
        print()
        await cmd_tables(db_url)
    except Exception as e:
        err(f"Aborted: {e}")
    finally:
        await engine.dispose()


async def cmd_reset(db_url: str):
    """Drop all tables and recreate from scratch."""
    print(f"\n{BOLD}{RED}⚠️  RESET DATABASE{RESET}")
    sep()
    warn("This will DELETE ALL DATA in the database!")
    confirm = input(f"  Type {BOLD}yes{RESET} to confirm: ").strip()
    if confirm.lower() != "yes":
        info("Reset cancelled.")
        return

    engine = make_engine(db_url)
    from sqlalchemy import text

    drop_sql = """
    DROP TABLE IF EXISTS group_settings CASCADE;
    DROP TABLE IF EXISTS blocked_users CASCADE;
    DROP TABLE IF EXISTS message_receipts CASCADE;
    DROP TABLE IF EXISTS messages CASCADE;
    DROP TABLE IF EXISTS conversation_members CASCADE;
    DROP TABLE IF EXISTS conversations CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    """

    try:
        async with engine.begin() as conn:
            print("\n  Dropping tables...")
            await conn.execute(text(drop_sql))
            ok("All tables dropped")

            print("  Recreating tables...")
            await conn.execute(text(CREATE_TABLES_SQL))
            ok("All tables recreated")
    except Exception as e:
        err(f"Reset failed: {e}")
    finally:
        await engine.dispose()


async def cmd_view(db_url: str, table: str):
    """View rows in a table."""
    if not table:
        err("Specify a table name:  python db_manager.py view <table>")
        return

    engine = make_engine(db_url)
    from sqlalchemy import text

    try:
        async with engine.connect() as conn:
            count_r = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            total = count_r.scalar()

            result = await conn.execute(text(f"SELECT * FROM {table} LIMIT 10"))
            rows = result.fetchall()
            cols = result.keys()

            print(f"\n{BOLD}  Table: {table}  ({total} total rows, showing up to 10){RESET}\n")

            if not rows:
                info("Table is empty.")
                return

            # Print header
            col_widths = [max(len(str(c)), 12) for c in cols]
            header = "  " + "  ".join(str(c).ljust(w) for c, w in zip(cols, col_widths))
            print(f"{CYAN}{header}{RESET}")
            print("  " + "  ".join("─" * w for w in col_widths))

            for row in rows:
                line = "  ".join(str(v)[:w].ljust(w) if v is not None else "NULL".ljust(w)
                                 for v, w in zip(row, col_widths))
                print(f"  {line}")

            if total > 10:
                warn(f"Showing 10 of {total} rows")

    except Exception as e:
        err(f"{e}")
    finally:
        await engine.dispose()


def cmd_fix_ip():
    """Print exact steps to whitelist current IP in AWS RDS Security Group."""
    my_ip = get_my_public_ip()

    print(f"""
{BOLD}🔧 HOW TO WHITELIST YOUR IP IN AWS RDS{RESET}
{sep.__doc__ and '' or ''}
{YELLOW}Your current public IP: {BOLD}{my_ip}{RESET}

Follow these steps in AWS Console:

  1. Go to:  https://console.aws.amazon.com/rds
  2. Click your RDS instance → "Connectivity & security" tab
  3. Click the Security Group link (e.g. "sg-xxxxxxxx")
  4. Click "Edit inbound rules" → "Add rule"
  5. Set:
        Type   : PostgreSQL
        Port   : 5432
        Source : My IP  ──→  this auto-fills {my_ip}/32

  6. Click "Save rules"
  7. Wait ~10 seconds, then run:  python db_manager.py ping

{CYAN}💡 Tip: If your ISP changes your IP, repeat the steps above.{RESET}
{CYAN}   For a permanent fix, consider deploying the backend to EC2
   in the same VPC as your RDS instance.{RESET}
""")


def print_help():
    print(__doc__)


# ─────────────────────────────────────────────
# ENTRYPOINT
# ─────────────────────────────────────────────
def load_dotenv():
    """
    Search for .env walking UP from the script's location.
    Covers running from: backend/scripts/, backend/, or project root.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Also check cwd (where you ran the command from)
    candidates = [
        os.path.join(script_dir, ".env"),               # same dir as script
        os.path.join(script_dir, "..", ".env"),          # one level up  ← backend/.env
        os.path.join(script_dir, "..", "..", ".env"),    # two levels up
        os.path.join(os.getcwd(), ".env"),               # current working directory
    ]

    for env_path in candidates:
        env_path = os.path.normpath(env_path)
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, _, v = line.partition("=")
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        os.environ.setdefault(k, v)
            print(f"\033[96m  ℹ️  Loaded .env from: {env_path}\033[0m")
            return

    print("\033[93m  ⚠️  No .env file found — using DEFAULT_DB_URL in script\033[0m")


async def main():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

    args = sys.argv[1:]
    cmd = args[0].lower() if args else "help"

    print(f"\n{BOLD}{'═' * 62}")
    print(f"  PAPYRIS DB MANAGER  —  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'═' * 62}{RESET}")

    host, port = parse_rds_host(db_url)
    info(f"DATABASE_URL → {host}:{port}")
    print()

    if cmd == "ping":
        await cmd_ping(db_url)

    elif cmd == "status":
        await cmd_status(db_url)

    elif cmd == "tables":
        connected = await cmd_ping(db_url)
        if connected:
            await cmd_tables(db_url)

    elif cmd == "create-tables":
        connected = await cmd_ping(db_url)
        if connected:
            await cmd_create_tables(db_url)

    elif cmd == "reset":
        connected = await cmd_ping(db_url)
        if connected:
            await cmd_reset(db_url)

    elif cmd == "view":
        table = args[1] if len(args) > 1 else None
        connected = await cmd_ping(db_url)
        if connected:
            await cmd_view(db_url, table)

    elif cmd == "fix-ip":
        cmd_fix_ip()

    else:
        print_help()

    print()


if __name__ == "__main__":
    asyncio.run(main())