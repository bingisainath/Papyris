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
from app.models.ai import AIModel, AppSetting, UserAISettings
from app.models.expense import (
    ConversationSettings, Expense, ExpenseEvent, ExpensePayer, ExpenseShare, Settlement,
)
from app.models.receipt import ItemPreference, Receipt, ReceiptAdjustment, ReceiptItem, StoreDiscountRule

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
    "AIModel",
    "AppSetting",
    "UserAISettings",
    "ConversationSettings",
    "Expense",
    "ExpenseEvent",
    "ExpensePayer",
    "ExpenseShare",
    "Settlement",
    "ItemPreference",
    "Receipt",
    "ReceiptAdjustment",
    "ReceiptItem",
    "StoreDiscountRule",
]
