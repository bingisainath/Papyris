"""
Models package - import all models here so they are registered on Base.metadata
(used by Alembic and scripts/create_tables.py).
"""
from app.models.user import User, UserStatus, Gender
from app.models.conversation import Conversation
from app.models.conversation_member import ConversationMember
from app.models.message import Message, MessageType
from app.models.message_receipt import MessageReceipt
from app.models.message_reaction import MessageReaction

__all__ = [
    "User",
    "UserStatus",
    "Gender",
    "Conversation",
    "ConversationMember",
    "Message",
    "MessageType",
    "MessageReceipt",
    "MessageReaction",
]
