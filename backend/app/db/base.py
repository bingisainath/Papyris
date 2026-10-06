# backend/app/db/base.py

from app.db.base_class import Base

# Models register themselves on Base when they are imported (see app/models/__init__.py)

__all__ = ["Base"]
