# from logging.config import fileConfig
# from alembic import context
# from sqlalchemy import engine_from_config, pool

# from app.config.settings import settings
# from app.db.base import Base
# from app import models  # noqa: ensure models are imported for metadata

# config = context.config
    
# if config.config_file_name:
#     fileConfig(config.config_file_name, disable_existing_loggers=False)

# target_metadata = Base.metadata

# def run_migrations_offline():
#     context.configure(
#         url=settings.DATABASE_URL.replace("+asyncpg", ""),
#         target_metadata=target_metadata,
#         literal_binds=True,
#         dialect_opts={"paramstyle": "named"},
#     )
#     with context.begin_transaction():
#         context.run_migrations()

# def run_migrations_online():
#     connectable = engine_from_config(
#         {"sqlalchemy.url": settings.DATABASE_URL.replace("+asyncpg", "")},
#         prefix="sqlalchemy.",
#         poolclass=pool.NullPool,
#     )
#     with connectable.connect() as connection:
#         context.configure(connection=connection, target_metadata=target_metadata)
#         with context.begin_transaction():
#             context.run_migrations()

# if context.is_offline_mode():
#     run_migrations_offline()
# else:
#     run_migrations_online()


# alembic/env.py



# alembic/env.py

import sys
import os

# ✅ Add backend root to PYTHONPATH
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pathlib import Path
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# ✅ FIX: Add parent directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Now we can import app modules
from app.config.settings import settings
from app.db.base import Base

# Import all models so Alembic can detect them
from app.models.user import User
from app.models.conversation import Conversation
from app.models.conversation_member import ConversationMember
from app.models.message import Message
from app.models.message_receipt import MessageReceipt

# this is the Alembic Config object
config = context.config

# ✅ FIX: Convert asyncpg URL to psycopg2 for migrations
# Alembic needs synchronous connection, but app uses async
sync_db_url = settings.DATABASE_URL.replace(
    "postgresql+asyncpg://", 
    "postgresql+psycopg2://"
).replace(
    "postgresql://",
    "postgresql+psycopg2://"
)

config.set_main_option("sqlalchemy.url", sync_db_url)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()