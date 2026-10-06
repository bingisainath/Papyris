"""
Set up or update the database schema.

Alembic migrations (backend/alembic/versions) are the source of truth. This script:
  1. For databases created before migrations existed (by the old version of this
     script): adds anything the baseline expects, then marks them as being at the
     baseline revision ("stamp").
  2. Runs `alembic upgrade head` to apply any newer migrations.

Safe to run repeatedly. Equivalent for new databases: `alembic upgrade head`.
"""

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.chdir(BACKEND_DIR)

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import create_engine, inspect, text  # noqa: E402

from app.config.settings import settings  # noqa: E402
from app.db.base import Base  # noqa: E402
import app.models  # noqa: E402,F401  (registers every model)

BASELINE_REVISION = "0001"

# Columns added to existing tables before migrations existed (pre-baseline databases)
LEGACY_ADDED_COLUMNS = [
    "ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_width INTEGER",
    "ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_height INTEGER",
]


def sync_url() -> str:
    return settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")


def main() -> None:
    print("=" * 60)
    print("PAPYRIS DATABASE SETUP")
    print("=" * 60)

    engine = create_engine(sync_url())
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        print(f"❌ Cannot connect to the database: {e}")
        print("   Check DATABASE_URL in backend/.env and that Postgres is running.")
        sys.exit(1)

    tables = set(inspect(engine).get_table_names())
    alembic_cfg = Config(str(BACKEND_DIR / "alembic.ini"))

    if "alembic_version" not in tables and "users" in tables:
        print("📦 Existing database without migrations: bringing it up to the baseline...")
        with engine.begin() as conn:
            Base.metadata.create_all(conn)  # only creates missing tables
            for statement in LEGACY_ADDED_COLUMNS:
                conn.execute(text(statement))
        command.stamp(alembic_cfg, BASELINE_REVISION)
        print(f"✅ Marked as migration {BASELINE_REVISION}\n")

    print("🚀 Applying migrations (alembic upgrade head)...")
    command.upgrade(alembic_cfg, "head")

    tables = sorted(inspect(engine).get_table_names())
    print("\n✅ DATABASE SETUP COMPLETE!")
    print("   Tables:", ", ".join(t for t in tables if t != "alembic_version"))
    engine.dispose()


if __name__ == "__main__":
    main()
