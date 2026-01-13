# from sqlalchemy.orm import DeclarativeBase

# class Base(DeclarativeBase):
#     pass


# from app.db.base import Base
# from app.db.session import get_db, engine

# __all__ = ["Base", "get_db", "engine"]

from app.db.base_class import Base

# import all models so Alembic can see them

# from app.models.user import User
# from app.db.base_class import Base
# from app.models.conversation import Conversation
# from app.models.conversation_member import ConversationMember
# from app.models.message import Message
