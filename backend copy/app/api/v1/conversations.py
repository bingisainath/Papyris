# # backend/app/api/conversations.py

# from fastapi import APIRouter, Depends, HTTPException, Query
# from sqlalchemy.ext.asyncio import AsyncSession
# from sqlalchemy import select, and_, or_, func
# from sqlalchemy.orm import selectinload
# from typing import List, Optional
# from uuid import UUID

# from app.db.session import get_db
# from app.models.user import User
# from app.models.conversation import Conversation, ConversationMember
# from app.models.message import Message
# from app.api.dependencies import get_current_user
# from pydantic import BaseModel
# from datetime import datetime

# router = APIRouter()


# # Response Models
# class UserResponse(BaseModel):
#     id: str
#     username: str
#     email: str
#     avatar: Optional[str] = None
#     is_online: bool = False

#     class Config:
#         from_attributes = True


# class MessageResponse(BaseModel):
#     id: str
#     conversation_id: str
#     sender_id: str
#     text: str
#     created_at: datetime
#     sender: Optional[UserResponse] = None

#     class Config:
#         from_attributes = True


# class ConversationResponse(BaseModel):
#     id: str
#     kind: str
#     title: Optional[str] = None
#     avatar_url: Optional[str] = None
#     created_at: datetime
#     updated_at: datetime
#     last_message: Optional[MessageResponse] = None
#     unread_count: int = 0
#     other_user: Optional[UserResponse] = None
#     members: List[UserResponse] = []

#     class Config:
#         from_attributes = True


# class CreateConversationRequest(BaseModel):
#     kind: str  # 'dm' or 'group'
#     title: Optional[str] = None
#     participant_ids: List[str]


# # GET /api/v1/conversations - List all conversations
# @router.get("/conversations", response_model=dict)
# async def get_conversations(
#     current_user: User = Depends(get_current_user),
#     db: AsyncSession = Depends(get_db)
# ):
#     """Get all conversations for the current user"""
#     try:
#         # Get all conversation IDs for current user
#         stmt = (
#             select(ConversationMember.conversation_id)
#             .where(ConversationMember.user_id == current_user.id)
#         )
#         result = await db.execute(stmt)
#         conversation_ids = [row[0] for row in result.fetchall()]

#         if not conversation_ids:
#             return {"success": True, "data": []}

#         # Get conversations with last message
#         stmt = (
#             select(Conversation)
#             .where(Conversation.id.in_(conversation_ids))
#             .options(selectinload(Conversation.members))
#             .order_by(Conversation.updated_at.desc())
#         )
#         result = await db.execute(stmt)
#         conversations = result.scalars().all()

#         # Build response
#         response_data = []
#         for conv in conversations:
#             # Get last message
#             msg_stmt = (
#                 select(Message)
#                 .where(Message.conversation_id == conv.id)
#                 .order_by(Message.created_at.desc())
#                 .limit(1)
#             )
#             msg_result = await db.execute(msg_stmt)
#             last_message = msg_result.scalar_one_or_none()

#             # Get unread count
#             if last_message:
#                 unread_stmt = (
#                     select(func.count(Message.id))
#                     .where(
#                         and_(
#                             Message.conversation_id == conv.id,
#                             Message.sender_id != current_user.id,
#                             Message.created_at > last_message.created_at
#                         )
#                     )
#                 )
#                 unread_result = await db.execute(unread_stmt)
#                 unread_count = unread_result.scalar() or 0
#             else:
#                 unread_count = 0

#             # Get other user for DM
#             other_user = None
#             if conv.kind == 'dm':
#                 for member in conv.members:
#                     if member.user_id != current_user.id:
#                         user_stmt = select(User).where(User.id == member.user_id)
#                         user_result = await db.execute(user_stmt)
#                         other_user_obj = user_result.scalar_one_or_none()
#                         if other_user_obj:
#                             other_user = {
#                                 "id": str(other_user_obj.id),
#                                 "username": other_user_obj.username,
#                                 "email": other_user_obj.email,
#                                 "avatar": other_user_obj.avatar,
#                                 "is_online": False  # TODO: Get from Redis
#                             }
#                         break

#             # Get all members for groups
#             members = []
#             if conv.kind == 'group':
#                 for member in conv.members:
#                     user_stmt = select(User).where(User.id == member.user_id)
#                     user_result = await db.execute(user_stmt)
#                     user_obj = user_result.scalar_one_or_none()
#                     if user_obj:
#                         members.append({
#                             "id": str(user_obj.id),
#                             "username": user_obj.username,
#                             "email": user_obj.email,
#                             "avatar": user_obj.avatar,
#                             "is_online": False
#                         })

#             conv_data = {
#                 "id": str(conv.id),
#                 "kind": conv.kind,
#                 "title": conv.title,
#                 "avatar_url": conv.avatar_url,
#                 "created_at": conv.created_at.isoformat(),
#                 "updated_at": conv.updated_at.isoformat(),
#                 "last_message": {
#                     "id": str(last_message.id),
#                     "text": last_message.text,
#                     "created_at": last_message.created_at.isoformat(),
#                     "sender_id": str(last_message.sender_id)
#                 } if last_message else None,
#                 "unread_count": unread_count,
#                 "other_user": other_user,
#                 "members": members
#             }
#             response_data.append(conv_data)

#         return {"success": True, "data": response_data}

#     except Exception as e:
#         print(f"Error fetching conversations: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# # GET /api/v1/conversations/:id/messages - Get messages for conversation
# @router.get("/conversations/{conversation_id}/messages", response_model=dict)
# async def get_messages(
#     conversation_id: UUID,
#     limit: int = Query(50, ge=1, le=100),
#     offset: int = Query(0, ge=0),
#     current_user: User = Depends(get_current_user),
#     db: AsyncSession = Depends(get_db)
# ):
#     """Get messages for a conversation"""
#     try:
#         # Verify user is member of conversation
#         member_stmt = (
#             select(ConversationMember)
#             .where(
#                 and_(
#                     ConversationMember.conversation_id == conversation_id,
#                     ConversationMember.user_id == current_user.id
#                 )
#             )
#         )
#         member_result = await db.execute(member_stmt)
#         member = member_result.scalar_one_or_none()

#         if not member:
#             raise HTTPException(status_code=403, detail="Not a member of this conversation")

#         # Get messages
#         stmt = (
#             select(Message)
#             .where(Message.conversation_id == conversation_id)
#             .order_by(Message.created_at.asc())
#             .limit(limit)
#             .offset(offset)
#         )
#         result = await db.execute(stmt)
#         messages = result.scalars().all()

#         # Build response with sender info
#         response_data = []
#         for msg in messages:
#             # Get sender
#             sender_stmt = select(User).where(User.id == msg.sender_id)
#             sender_result = await db.execute(sender_stmt)
#             sender = sender_result.scalar_one_or_none()

#             msg_data = {
#                 "id": str(msg.id),
#                 "conversation_id": str(msg.conversation_id),
#                 "sender_id": str(msg.sender_id),
#                 "text": msg.text,
#                 "created_at": msg.created_at.isoformat(),
#                 "sender": {
#                     "id": str(sender.id),
#                     "username": sender.username,
#                     "email": sender.email,
#                     "avatar": sender.avatar
#                 } if sender else None
#             }
#             response_data.append(msg_data)

#         return {"success": True, "data": response_data}

#     except HTTPException:
#         raise
#     except Exception as e:
#         print(f"Error fetching messages: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# # POST /api/v1/conversations - Create new conversation
# @router.post("/conversations", response_model=dict)
# async def create_conversation(
#     request: CreateConversationRequest,
#     current_user: User = Depends(get_current_user),
#     db: AsyncSession = Depends(get_db)
# ):
#     """Create a new conversation (DM or group)"""
#     try:
#         # Validate kind
#         if request.kind not in ['dm', 'group']:
#             raise HTTPException(status_code=400, detail="Kind must be 'dm' or 'group'")

#         # For DM, check if conversation already exists
#         if request.kind == 'dm':
#             if len(request.participant_ids) != 1:
#                 raise HTTPException(status_code=400, detail="DM must have exactly 1 other participant")

#             other_user_id = UUID(request.participant_ids[0])

#             # Check if DM already exists
#             existing_stmt = (
#                 select(Conversation)
#                 .join(ConversationMember, Conversation.id == ConversationMember.conversation_id)
#                 .where(
#                     and_(
#                         Conversation.kind == 'dm',
#                         ConversationMember.user_id.in_([current_user.id, other_user_id])
#                     )
#                 )
#                 .group_by(Conversation.id)
#                 .having(func.count(ConversationMember.user_id) == 2)
#             )
#             existing_result = await db.execute(existing_stmt)
#             existing_conv = existing_result.scalar_one_or_none()

#             if existing_conv:
#                 return {"success": True, "data": {"id": str(existing_conv.id)}}

#         # Create new conversation
#         new_conv = Conversation(
#             kind=request.kind,
#             title=request.title
#         )
#         db.add(new_conv)
#         await db.flush()

#         # Add current user as member
#         member = ConversationMember(
#             conversation_id=new_conv.id,
#             user_id=current_user.id,
#             role='admin'
#         )
#         db.add(member)

#         # Add other participants
#         for participant_id in request.participant_ids:
#             member = ConversationMember(
#                 conversation_id=new_conv.id,
#                 user_id=UUID(participant_id),
#                 role='member'
#             )
#             db.add(member)

#         await db.commit()
#         await db.refresh(new_conv)

#         # Get other user for DM
#         other_user = None
#         if new_conv.kind == 'dm':
#             other_user_id = UUID(request.participant_ids[0])
#             user_stmt = select(User).where(User.id == other_user_id)
#             user_result = await db.execute(user_stmt)
#             other_user_obj = user_result.scalar_one_or_none()
#             if other_user_obj:
#                 other_user = {
#                     "id": str(other_user_obj.id),
#                     "username": other_user_obj.username,
#                     "email": other_user_obj.email,
#                     "avatar": other_user_obj.avatar
#                 }

#         return {
#             "success": True,
#             "data": {
#                 "id": str(new_conv.id),
#                 "kind": new_conv.kind,
#                 "title": new_conv.title,
#                 "created_at": new_conv.created_at.isoformat(),
#                 "other_user": other_user
#             }
#         }

#     except HTTPException:
#         raise
#     except Exception as e:
#         await db.rollback()
#         print(f"Error creating conversation: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# # GET /api/v1/users - List all users
# @router.get("/users", response_model=dict)
# async def get_users(
#     search: Optional[str] = Query(None),
#     current_user: User = Depends(get_current_user),
#     db: AsyncSession = Depends(get_db)
# ):
#     """Get all users (excluding current user)"""
#     try:
#         stmt = select(User).where(User.id != current_user.id)

#         # Add search filter
#         if search:
#             stmt = stmt.where(
#                 or_(
#                     User.username.ilike(f"%{search}%"),
#                     User.email.ilike(f"%{search}%")
#                 )
#             )

#         stmt = stmt.limit(50)
#         result = await db.execute(stmt)
#         users = result.scalars().all()

#         response_data = [
#             {
#                 "id": str(user.id),
#                 "username": user.username,
#                 "email": user.email,
#                 "avatar": user.avatar,
#                 "name": user.username  # Use username as name for now
#             }
#             for user in users
#         ]

#         return {"success": True, "data": response_data}

#     except Exception as e:
#         print(f"Error fetching users: {e}")
#         raise HTTPException(status_code=500, detail=str(e))