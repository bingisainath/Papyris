# # backend/app/api/v1/chat.py 

# from fastapi import APIRouter, Depends, HTTPException, Query
# from sqlalchemy.ext.asyncio import AsyncSession
# from sqlalchemy import select, and_, or_, func
# from sqlalchemy.orm import selectinload
# from typing import List, Optional
# from uuid import UUID

# from app.db.session import get_db

# from app.models.user import User
# from app.models.message import Message
# from app.models.conversation import Conversation
# from app.models.conversation_member import ConversationMember

# from app.api.dependencies import get_current_user
# from pydantic import BaseModel
# from datetime import datetime, timezone

# router = APIRouter()


# # Request/Response Models
# class CreateConversationRequest(BaseModel):
#     kind: str  # 'dm' or 'group'
#     title: Optional[str] = None
#     participant_ids: List[str]

# @router.get("/conversations")
# async def get_conversations(
#     current_user: User = Depends(get_current_user),
#     db: AsyncSession = Depends(get_db)
# ):
#     """Get all conversations for the current user"""
#     try:
#         # Get conversations where user is a member
#         stmt = (
#             select(Conversation)
#             .join(ConversationMember)
#             .where(ConversationMember.user_id == current_user.id)
#             .options(selectinload(Conversation.members))
#             .order_by(Conversation.updated_at.desc())
#         )
        
#         result = await db.execute(stmt)
#         conversations = result.scalars().all()

#         # Build response
#         response_data = []
#         for conv in conversations:
#             # ✅ Get all member IDs (just IDs, not full objects)
#             members_stmt = select(ConversationMember.user_id).where(
#                 ConversationMember.conversation_id == conv.id
#             )
#             members_result = await db.execute(members_stmt)
#             member_ids = [str(uid) for uid in members_result.scalars().all()]

#             # Get last message
#             msg_stmt = (
#                 select(Message)
#                 .where(Message.conversation_id == conv.id)
#                 .order_by(Message.created_at.desc())
#                 .limit(1)
#             )
#             msg_result = await db.execute(msg_stmt)
#             last_message = msg_result.scalar_one_or_none()

#             # ✅ ADD DETAILED DEBUG LOGGING
#             print(f"\n{'='*60}")
#             print(f"📊 Processing conversation: {conv.id}")
#             print(f"   Name/Title: {conv.title if conv.kind == 'group' else 'DM'}")

#             # ✅ CALCULATE REAL UNREAD COUNT
#             # Get user's last_read_message_id from conversation_members
#             member_stmt = select(ConversationMember).where(
#                 ConversationMember.conversation_id == conv.id,
#                 ConversationMember.user_id == current_user.id
#             )
#             member_result = await db.execute(member_stmt)
#             member = member_result.scalar_one_or_none()

#             if member:
#                 print(f"   User's last_read_message_id: {member.last_read_message_id}")
#             else:
#                 print(f"   ⚠️ User is not a member!")
            
#             # Count total messages
#             total_msg_stmt = select(func.count(Message.id)).where(
#                 Message.conversation_id == conv.id
#             )
#             total_result = await db.execute(total_msg_stmt)
#             total_messages = total_result.scalar() or 0
#             print(f"   Total messages: {total_messages}")

#             unread_count = 0

#             if member:
#                 if member.last_read_message_id:
#                     # Count messages after last_read_message_id
#                     last_read_msg_stmt = select(Message).where(
#                         Message.id == member.last_read_message_id
#                     )
#                     last_read_result = await db.execute(last_read_msg_stmt)
#                     last_read_msg = last_read_result.scalar_one_or_none()
                    
#                     if last_read_msg:
#                         # Count messages created after last read message
#                         unread_stmt = select(func.count(Message.id)).where(
#                             Message.conversation_id == conv.id,
#                             Message.created_at > last_read_msg.created_at,
#                             Message.sender_id != current_user.id  # Don't count own messages
#                         )
#                         unread_result = await db.execute(unread_stmt)
#                         unread_count = unread_result.scalar() or 0
#                 else:
#                     # No last read message - count all messages from others
#                     unread_stmt = select(func.count(Message.id)).where(
#                         Message.conversation_id == conv.id,
#                         Message.sender_id != current_user.id
#                     )
#                     unread_result = await db.execute(unread_stmt)
#                     unread_count = unread_result.scalar() or 0

#             print(f"📊 Conversation {conv.id}: unread_count = {unread_count}")

#             # ✅ Get other user for DM (to get name and avatar)
#             other_user = None
#             if conv.kind == 'dm':
#                 # Find the other user (not current user)
#                 other_user_id = next((uid for uid in member_ids if uid != str(current_user.id)), None)
#                 if other_user_id:
#                     user_stmt = select(User).where(User.id == UUID(other_user_id))
#                     user_result = await db.execute(user_stmt)
#                     other_user = user_result.scalar_one_or_none()

#             # ✅ Format response to match frontend expectations
#             conv_data = {
#                 "id": str(conv.id),
#                 "name": other_user.username if other_user else (conv.title or "Unknown"),
#                 "avatar": other_user.avatar if other_user else conv.avatar_url,
#                 "lastMessage": last_message.text if last_message else "",
#                 "lastMessageTime": last_message.created_at.isoformat() if last_message else None,
#                 "unreadCount": unread_count, 
#                 "isOnline": False,  # Will be updated by frontend based on online users
#                 "isGroup": conv.kind == "group",
#                 "members": member_ids,
#                 "isPinned": False,
#                 "isTyping": False,
#             }
#             response_data.append(conv_data)

#         return {
#             "success": True,
#             "data": response_data,
#             "message": "Conversations fetched successfully"
#         }

#     except Exception as e:
#         print(f"❌ Error fetching conversations: {e}")
#         import traceback
#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=str(e))


# # GET /api/v1/conversations/:id/messages - Get messages
# @router.get("/conversations/{conversation_id}/messages")
# async def get_messages(
#     conversation_id: UUID,
#     limit: int = Query(50, ge=1, le=100),
#     offset: int = Query(0, ge=0),
#     current_user: User = Depends(get_current_user),
#     db: AsyncSession = Depends(get_db)
# ):
#     """Get messages for a conversation"""
#     try:
#         # Verify user is member
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
#             raise HTTPException(
#                 status_code=403,
#                 detail="Not a member of this conversation"
#             )

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
#                 "status": "delivered",  # Default status
#                 "sender": {
#                     "id": str(sender.id),
#                     "username": sender.username,
#                     "email": sender.email,
#                     "avatar": sender.avatar
#                 } if sender else None
#             }
#             response_data.append(msg_data)

#         return {
#             "success": True,
#             "data": response_data,
#             "message": "Messages fetched successfully"
#         }

#     except HTTPException:
#         raise
#     except Exception as e:
#         print(f"❌ Error fetching messages: {e}")
#         import traceback
#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=str(e))


# @router.post("/conversations/{conversation_id}/mark-read")
# async def mark_conversation_read(
#     conversation_id: UUID,
#     current_user: User = Depends(get_current_user),
#     db: AsyncSession = Depends(get_db)
# ):
#     """Mark all messages in conversation as read up to the latest message"""
#     try:
#         # Verify user is member
#         member_stmt = select(ConversationMember).where(
#             ConversationMember.conversation_id == conversation_id,
#             ConversationMember.user_id == current_user.id
#         )
#         member_result = await db.execute(member_stmt)
#         member = member_result.scalar_one_or_none()

#         if not member:
#             raise HTTPException(status_code=403, detail="Not a member of this conversation")

#         # Get latest message in conversation
#         latest_msg_stmt = (
#             select(Message)
#             .where(Message.conversation_id == conversation_id)
#             .order_by(Message.created_at.desc())
#             .limit(1)
#         )
#         latest_result = await db.execute(latest_msg_stmt)
#         latest_message = latest_result.scalar_one_or_none()

#         if latest_message:
#             # Update last_read_message_id
#             member.last_read_message_id = latest_message.id
#             member.last_read_at = datetime.now(timezone.utc)
#             await db.commit()

#             print(f"✅ Marked conversation {conversation_id} as read for user {current_user.id}")

#             return {
#                 "success": True,
#                 "message": "Conversation marked as read",
#                 "last_read_message_id": str(latest_message.id)
#             }
#         else:
#             return {
#                 "success": True,
#                 "message": "No messages to mark as read"
#             }

#     except HTTPException:
#         raise
#     except Exception as e:
#         await db.rollback()
#         print(f"❌ Error marking as read: {e}")
#         import traceback
#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=str(e))


# # POST /api/v1/conversations
# @router.post("/conversations")
# async def create_conversation(
#     request: CreateConversationRequest,
#     current_user: User = Depends(get_current_user),
#     db: AsyncSession = Depends(get_db)
# ):
#     """Create a new conversation (DM or group)"""
#     try:
#         # Validate kind
#         if request.kind not in ['dm', 'group']:
#             raise HTTPException(
#                 status_code=400,
#                 detail="Kind must be 'dm' or 'group'"
#             )

#         # For DM, check if conversation already exists
#         if request.kind == 'dm':
#             if len(request.participant_ids) != 1:
#                 raise HTTPException(
#                     status_code=400,
#                     detail="DM must have exactly 1 other participant"
#                 )

#             other_user_id = UUID(request.participant_ids[0])

#             # Check if DM already exists between these two users
#             # This is a bit complex - we need to find conversations where
#             # both users are members and it's a DM
#             stmt = (
#                 select(Conversation.id)
#                 .join(ConversationMember)
#                 .where(
#                     and_(
#                         Conversation.kind == 'dm',
#                         ConversationMember.user_id.in_([current_user.id, other_user_id])
#                     )
#                 )
#                 .group_by(Conversation.id)
#                 .having(func.count(ConversationMember.user_id) == 2)
#             )
#             result = await db.execute(stmt)
#             existing_conv_id = result.scalar_one_or_none()

#             if existing_conv_id:
#                 return {
#                     "success": True,
#                     "data": {"id": str(existing_conv_id)},
#                     "message": "Conversation already exists"
#                 }

#         # Create new conversation
#         new_conv = Conversation(
#             kind=request.kind,
#             title=request.title
#         )
#         db.add(new_conv)
#         await db.flush()

#         from app.models.conversation_member import MemberRole

#         # Add current user as member
#         member = ConversationMember(
#             conversation_id=new_conv.id,
#             user_id=current_user.id,
#             role=MemberRole.ADMIN
#         )
#         db.add(member)

#         # Add other participants
#         for participant_id in request.participant_ids:
#             member = ConversationMember(
#                 conversation_id=new_conv.id,
#                 user_id=UUID(participant_id),
#                 role=MemberRole.MEMBER
#             )
#             db.add(member)

#         await db.commit()
#         await db.refresh(new_conv)

#         # Get other user info for DM
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
#             },
#             "message": "Conversation created successfully"
#         }

#     except HTTPException:
#         raise
#     except Exception as e:
#         await db.rollback()
#         print(f"❌ Error creating conversation: {e}")
#         import traceback
#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=str(e))


# # GET /api/v1/users
# @router.get("/users")
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
#                 "name": user.username  # Use username as name
#             }
#             for user in users
#         ]

#         return {
#             "success": True,
#             "data": response_data,
#             "message": "Users fetched successfully"
#         }

#     except Exception as e:
#         print(f"❌ Error fetching users: {e}")
#         import traceback
#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=str(e))



# backend/app/api/v1/chat.py - ENHANCED VERSION

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, text
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.user import User
from app.models.message import Message
from app.models.conversation import Conversation
from app.models.conversation_member import ConversationMember, MemberRole
from app.models.message_receipt import MessageReceipt, ReceiptStatus
from app.models.blocked_user import BlockedUser
from app.models.group_settings import GroupSettings

from app.api.dependencies import get_current_user
from pydantic import BaseModel

router = APIRouter()


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class CreateConversationRequest(BaseModel):
    kind: str  # 'dm' or 'group'
    title: Optional[str] = None
    participant_ids: List[str]


class UpdateGroupSettingsRequest(BaseModel):
    only_admins_can_message: Optional[bool] = None
    only_admins_can_add_members: Optional[bool] = None
    send_message_notification: Optional[bool] = None


# ============================================
# HELPER FUNCTIONS
# ============================================

async def is_blocked(user1_id: UUID, user2_id: UUID, db: AsyncSession) -> bool:
    """Check if either user has blocked the other"""
    stmt = select(BlockedUser).where(
        or_(
            and_(BlockedUser.blocker_id == user1_id, BlockedUser.blocked_id == user2_id),
            and_(BlockedUser.blocker_id == user2_id, BlockedUser.blocked_id == user1_id)
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None


# ============================================
# CONVERSATIONS ENDPOINTS
# ============================================

@router.get("/conversations")
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all conversations for the current user"""
    try:
        # Get conversations where user is a member
        stmt = (
            select(Conversation)
            .join(ConversationMember)
            .where(ConversationMember.user_id == current_user.id)
            .options(selectinload(Conversation.members))
            .order_by(Conversation.updated_at.desc())
        )
        
        result = await db.execute(stmt)
        conversations = result.scalars().all()

        # Build response
        response_data = []
        for conv in conversations:
            # Get all member IDs
            members_stmt = select(ConversationMember.user_id).where(
                ConversationMember.conversation_id == conv.id
            )
            members_result = await db.execute(members_stmt)
            member_ids = [str(uid) for uid in members_result.scalars().all()]

            # Get last message
            msg_stmt = (
                select(Message)
                .where(Message.conversation_id == conv.id)
                .order_by(Message.created_at.desc())
                .limit(1)
            )
            msg_result = await db.execute(msg_stmt)
            last_message = msg_result.scalar_one_or_none()

            # Calculate unread count
            member_stmt = select(ConversationMember).where(
                ConversationMember.conversation_id == conv.id,
                ConversationMember.user_id == current_user.id
            )
            member_result = await db.execute(member_stmt)
            member = member_result.scalar_one_or_none()

            unread_count = 0
            if member:
                if member.last_read_message_id:
                    # Count messages after last_read_message_id
                    last_read_msg_stmt = select(Message).where(
                        Message.id == member.last_read_message_id
                    )
                    last_read_result = await db.execute(last_read_msg_stmt)
                    last_read_msg = last_read_result.scalar_one_or_none()
                    
                    if last_read_msg:
                        unread_stmt = select(func.count(Message.id)).where(
                            Message.conversation_id == conv.id,
                            Message.created_at > last_read_msg.created_at,
                            Message.sender_id != current_user.id
                        )
                        unread_result = await db.execute(unread_stmt)
                        unread_count = unread_result.scalar() or 0
                else:
                    # No last read message - count all messages from others
                    unread_stmt = select(func.count(Message.id)).where(
                        Message.conversation_id == conv.id,
                        Message.sender_id != current_user.id
                    )
                    unread_result = await db.execute(unread_stmt)
                    unread_count = unread_result.scalar() or 0

            # Get other user for DM
            other_user = None
            if conv.kind == 'dm':
                other_user_id = next((uid for uid in member_ids if uid != str(current_user.id)), None)
                if other_user_id:
                    # ✅ Check if blocked
                    if await is_blocked(current_user.id, UUID(other_user_id), db):
                        continue  # Skip blocked conversations
                    
                    user_stmt = select(User).where(User.id == UUID(other_user_id))
                    user_result = await db.execute(user_stmt)
                    other_user = user_result.scalar_one_or_none()

            # Format response
            conv_data = {
                "id": str(conv.id),
                "name": other_user.username if other_user else (conv.title or "Unknown"),
                "avatar": other_user.avatar if other_user else conv.avatar_url,
                "lastMessage": last_message.text if last_message else "",
                "lastMessageTime": last_message.created_at.isoformat() if last_message else None,
                "unreadCount": unread_count,
                "isOnline": False,
                "isGroup": conv.kind == "group",
                "members": member_ids,
                "isPinned": False,
                "isTyping": False,
            }
            response_data.append(conv_data)

        return {
            "success": True,
            "data": response_data,
            "message": "Conversations fetched successfully"
        }

    except Exception as e:
        print(f"❌ Error fetching conversations: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversations")
async def create_conversation(
    request: CreateConversationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new conversation (DM or group)"""
    try:
        # Validate kind
        if request.kind not in ['dm', 'group']:
            raise HTTPException(status_code=400, detail="Kind must be 'dm' or 'group'")

        # For DM, check if conversation already exists
        if request.kind == 'dm':
            if len(request.participant_ids) != 1:
                raise HTTPException(status_code=400, detail="DM must have exactly 1 other participant")

            other_user_id = UUID(request.participant_ids[0])

            # ✅ Check if blocked
            if await is_blocked(current_user.id, other_user_id, db):
                raise HTTPException(status_code=403, detail="Cannot create conversation with blocked user")

            # Check if DM already exists
            stmt = (
                select(Conversation.id)
                .join(ConversationMember)
                .where(
                    and_(
                        Conversation.kind == 'dm',
                        ConversationMember.user_id.in_([current_user.id, other_user_id])
                    )
                )
                .group_by(Conversation.id)
                .having(func.count(ConversationMember.user_id) == 2)
            )
            result = await db.execute(stmt)
            existing_conv_id = result.scalar_one_or_none()

            if existing_conv_id:
                return {
                    "success": True,
                    "data": {"id": str(existing_conv_id)},
                    "message": "Conversation already exists"
                }

        # Create new conversation
        new_conv = Conversation(
            kind=request.kind,
            title=request.title
        )
        db.add(new_conv)
        await db.flush()

        # Add current user as admin
        member = ConversationMember(
            conversation_id=new_conv.id,
            user_id=current_user.id,
            role=MemberRole.ADMIN
        )
        db.add(member)

        # Add other participants
        for participant_id in request.participant_ids:
            member = ConversationMember(
                conversation_id=new_conv.id,
                user_id=UUID(participant_id),
                role=MemberRole.MEMBER
            )
            db.add(member)

        # ✅ Create default group settings for groups
        if request.kind == 'group':
            settings = GroupSettings(
                conversation_id=new_conv.id,
                only_admins_can_message=False,
                only_admins_can_add_members=True,
                send_message_notification=True
            )
            db.add(settings)

        await db.commit()
        await db.refresh(new_conv)

        # Get other user info for DM
        other_user = None
        if new_conv.kind == 'dm':
            other_user_id = UUID(request.participant_ids[0])
            user_stmt = select(User).where(User.id == other_user_id)
            user_result = await db.execute(user_stmt)
            other_user_obj = user_result.scalar_one_or_none()
            if other_user_obj:
                other_user = {
                    "id": str(other_user_obj.id),
                    "username": other_user_obj.username,
                    "email": other_user_obj.email,
                    "avatar": other_user_obj.avatar
                }

        return {
            "success": True,
            "data": {
                "id": str(new_conv.id),
                "kind": new_conv.kind,
                "title": new_conv.title,
                "created_at": new_conv.created_at.isoformat(),
                "other_user": other_user
            },
            "message": "Conversation created successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ Error creating conversation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# MESSAGES ENDPOINTS
# ============================================

@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get messages for a conversation"""
    try:
        # Verify user is member
        member_stmt = select(ConversationMember).where(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == current_user.id
            )
        )
        member_result = await db.execute(member_stmt)
        member = member_result.scalar_one_or_none()

        if not member:
            raise HTTPException(status_code=403, detail="Not a member of this conversation")

        # Get messages
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
            .limit(limit)
            .offset(offset)
        )
        result = await db.execute(stmt)
        messages = result.scalars().all()

        # Build response with sender info
        response_data = []
        for msg in messages:
            # Get sender
            sender_stmt = select(User).where(User.id == msg.sender_id)
            sender_result = await db.execute(sender_stmt)
            sender = sender_result.scalar_one_or_none()

            # ✅ Get read receipts for this message
            receipts_stmt = select(MessageReceipt).where(
                MessageReceipt.message_id == msg.id
            )
            receipts_result = await db.execute(receipts_stmt)
            receipts = receipts_result.scalars().all()

            # Determine status
            status = "sent"
            if msg.sender_id == current_user.id:
                # For sent messages, check receipts
                read_count = sum(1 for r in receipts if r.status == ReceiptStatus.READ)
                delivered_count = sum(1 for r in receipts if r.status == ReceiptStatus.DELIVERED)
                
                if read_count > 0:
                    status = "read"
                elif delivered_count > 0:
                    status = "delivered"
            
            msg_data = {
                "id": str(msg.id),
                "conversation_id": str(msg.conversation_id),
                "sender_id": str(msg.sender_id),
                "text": msg.text,
                "created_at": msg.created_at.isoformat(),
                "status": status,
                "sender": {
                    "id": str(sender.id),
                    "username": sender.username,
                    "email": sender.email,
                    "avatar": sender.avatar
                } if sender else None
            }
            response_data.append(msg_data)

        return {
            "success": True,
            "data": response_data,
            "message": "Messages fetched successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching messages: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversations/{conversation_id}/mark-read")
async def mark_conversation_read(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all messages in conversation as read"""
    try:
        # Verify user is member
        member_stmt = select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id
        )
        member_result = await db.execute(member_stmt)
        member = member_result.scalar_one_or_none()

        if not member:
            raise HTTPException(status_code=403, detail="Not a member of this conversation")

        # Get latest message in conversation
        latest_msg_stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        latest_result = await db.execute(latest_msg_stmt)
        latest_message = latest_result.scalar_one_or_none()

        if latest_message:
            # Update last_read_message_id
            member.last_read_message_id = latest_message.id
            member.last_read_at = datetime.now(timezone.utc)
            
            # ✅ Create/update read receipts for all unread messages
            unread_msgs_stmt = select(Message).where(
                Message.conversation_id == conversation_id,
                Message.sender_id != current_user.id
            )
            unread_result = await db.execute(unread_msgs_stmt)
            unread_messages = unread_result.scalars().all()
            
            now = datetime.now(timezone.utc)
            for msg in unread_messages:
                # Check if receipt exists
                receipt_stmt = select(MessageReceipt).where(
                    MessageReceipt.message_id == msg.id,
                    MessageReceipt.user_id == current_user.id
                )
                receipt_result = await db.execute(receipt_stmt)
                receipt = receipt_result.scalar_one_or_none()
                
                if receipt:
                    if receipt.status != ReceiptStatus.READ:
                        receipt.status = ReceiptStatus.READ
                        receipt.read_at = now
                else:
                    # Create new receipt
                    new_receipt = MessageReceipt(
                        message_id=msg.id,
                        user_id=current_user.id,
                        status=ReceiptStatus.READ,
                        delivered_at=now,
                        read_at=now
                    )
                    db.add(new_receipt)
            
            await db.commit()

            return {
                "success": True,
                "message": "Conversation marked as read",
                "last_read_message_id": str(latest_message.id)
            }
        else:
            return {
                "success": True,
                "message": "No messages to mark as read"
            }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ Error marking as read: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ✅ NEW: Message Search
@router.get("/messages/search")
async def search_messages(
    q: str = Query(..., min_length=1, description="Search query"),
    conversation_id: Optional[UUID] = Query(None),
    limit: int = Query(50, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Search messages using full-text search"""
    try:
        # Build base query - simple text search for now
        # Note: For production, you'd use PostgreSQL's full-text search
        stmt = select(Message).where(
            Message.text.ilike(f"%{q}%")
        )

        # Filter by conversation if specified
        if conversation_id:
            # Verify membership
            member_stmt = select(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == current_user.id
            )
            member_result = await db.execute(member_stmt)
            if not member_result.scalar_one_or_none():
                raise HTTPException(status_code=403, detail="Not a member of this conversation")
            
            stmt = stmt.where(Message.conversation_id == conversation_id)
        else:
            # Only search in user's conversations
            user_convs_stmt = select(ConversationMember.conversation_id).where(
                ConversationMember.user_id == current_user.id
            )
            user_convs_result = await db.execute(user_convs_stmt)
            conv_ids = [row[0] for row in user_convs_result.all()]
            
            if conv_ids:
                stmt = stmt.where(Message.conversation_id.in_(conv_ids))

        # Execute query
        stmt = stmt.order_by(Message.created_at.desc()).limit(limit)
        result = await db.execute(stmt)
        messages = result.scalars().all()

        # Format results
        results = []
        for msg in messages:
            # Get conversation
            conv_stmt = select(Conversation).where(Conversation.id == msg.conversation_id)
            conv_result = await db.execute(conv_stmt)
            conversation = conv_result.scalar_one_or_none()

            # Get sender
            sender_stmt = select(User).where(User.id == msg.sender_id)
            sender_result = await db.execute(sender_stmt)
            sender = sender_result.scalar_one_or_none()

            results.append({
                "message": {
                    "id": str(msg.id),
                    "text": msg.text,
                    "timestamp": msg.created_at.isoformat(),
                    "sender_id": str(msg.sender_id),
                    "sender_name": sender.username if sender else "Unknown"
                },
                "conversation": {
                    "id": str(conversation.id),
                    "name": conversation.title or "DM",
                    "avatar": conversation.avatar_url
                } if conversation else None,
                "matches": msg.text.lower().count(q.lower())
            })

        return {
            "success": True,
            "message": f"Found {len(results)} messages",
            "data": {
                "results": results,
                "count": len(results),
                "query": q
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error searching messages: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# BLOCKING ENDPOINTS
# ============================================

@router.post("/users/block/{user_id}")
async def block_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Block a user"""
    try:
        # Can't block yourself
        if user_id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot block yourself")

        # Check if user exists
        user_stmt = select(User).where(User.id == user_id)
        user_result = await db.execute(user_stmt)
        user_to_block = user_result.scalar_one_or_none()
        
        if not user_to_block:
            raise HTTPException(status_code=404, detail="User not found")

        # Check if already blocked
        existing_stmt = select(BlockedUser).where(
            BlockedUser.blocker_id == current_user.id,
            BlockedUser.blocked_id == user_id
        )
        existing_result = await db.execute(existing_stmt)
        existing_block = existing_result.scalar_one_or_none()

        if existing_block:
            return {
                "success": True,
                "message": "User already blocked",
                "data": {
                    "user_id": str(user_id),
                    "username": user_to_block.username,
                    "blocked_at": existing_block.blocked_at.isoformat()
                }
            }

        # Create block
        block = BlockedUser(
            blocker_id=current_user.id,
            blocked_id=user_id
        )
        db.add(block)
        await db.commit()
        await db.refresh(block)

        return {
            "success": True,
            "message": f"Successfully blocked {user_to_block.username}",
            "data": {
                "user_id": str(user_id),
                "username": user_to_block.username,
                "blocked_at": block.blocked_at.isoformat()
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ Error blocking user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/users/unblock/{user_id}")
async def unblock_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unblock a user"""
    try:
        stmt = select(BlockedUser).where(
            BlockedUser.blocker_id == current_user.id,
            BlockedUser.blocked_id == user_id
        )
        result = await db.execute(stmt)
        block = result.scalar_one_or_none()

        if not block:
            raise HTTPException(status_code=404, detail="User is not blocked")

        # Get user info
        user_stmt = select(User).where(User.id == user_id)
        user_result = await db.execute(user_stmt)
        user = user_result.scalar_one_or_none()

        await db.delete(block)
        await db.commit()

        return {
            "success": True,
            "message": f"Successfully unblocked {user.username if user else 'user'}",
            "data": {
                "user_id": str(user_id),
                "username": user.username if user else "Unknown"
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ Error unblocking user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/blocked")
async def get_blocked_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of blocked users"""
    try:
        stmt = select(BlockedUser).where(
            BlockedUser.blocker_id == current_user.id
        )
        result = await db.execute(stmt)
        blocks = result.scalars().all()

        if not blocks:
            return {
                "success": True,
                "message": "No blocked users",
                "data": {"blocked_users": []}
            }

        # Get user details
        blocked_user_ids = [b.blocked_id for b in blocks]
        users_stmt = select(User).where(User.id.in_(blocked_user_ids))
        users_result = await db.execute(users_stmt)
        users = users_result.scalars().all()

        # Create lookup
        blocked_at_map = {b.blocked_id: b.blocked_at for b in blocks}

        blocked_users_data = [
            {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "avatar": user.avatar,
                "blocked_at": blocked_at_map.get(user.id).isoformat()
            }
            for user in users
        ]

        return {
            "success": True,
            "message": f"Found {len(blocked_users_data)} blocked users",
            "data": {"blocked_users": blocked_users_data}
        }

    except Exception as e:
        print(f"❌ Error fetching blocked users: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# GROUP MANAGEMENT ENDPOINTS
# ============================================

@router.get("/groups/{group_id}/details")
async def get_group_details(
    group_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get complete group details"""
    try:
        # Get conversation
        conv_stmt = select(Conversation).where(Conversation.id == group_id)
        conv_result = await db.execute(conv_stmt)
        conversation = conv_result.scalar_one_or_none()

        if not conversation:
            raise HTTPException(status_code=404, detail="Group not found")

        # Verify membership
        member_stmt = select(ConversationMember).where(
            ConversationMember.conversation_id == group_id,
            ConversationMember.user_id == current_user.id
        )
        member_result = await db.execute(member_stmt)
        current_member = member_result.scalar_one_or_none()

        if not current_member:
            raise HTTPException(status_code=403, detail="You are not a member of this group")

        # Get all members
        members_stmt = select(ConversationMember).where(
            ConversationMember.conversation_id == group_id
        )
        members_result = await db.execute(members_stmt)
        members = members_result.scalars().all()

        # Get user info for each member
        member_data = []
        admin_ids = []

        for member in members:
            user_stmt = select(User).where(User.id == member.user_id)
            user_result = await db.execute(user_stmt)
            user = user_result.scalar_one_or_none()

            if user:
                member_data.append({
                    "id": str(user.id),
                    "username": user.username,
                    "email": user.email,
                    "avatar": user.avatar,
                    "role": member.role.value,
                    "is_online": getattr(user, 'is_online', False)
                })

                if member.role == MemberRole.ADMIN:
                    admin_ids.append(str(user.id))

        # Get group settings
        settings_stmt = select(GroupSettings).where(
            GroupSettings.conversation_id == group_id
        )
        settings_result = await db.execute(settings_stmt)
        settings = settings_result.scalar_one_or_none()

        settings_data = {
            "only_admins_can_message": settings.only_admins_can_message if settings else False,
            "only_admins_can_add_members": settings.only_admins_can_add_members if settings else True,
            "send_message_notification": settings.send_message_notification if settings else True
        }

        return {
            "success": True,
            "message": "Group details retrieved",
            "data": {
                "id": str(conversation.id),
                "name": conversation.title,
                "avatar": conversation.avatar_url,
                "created_at": conversation.created_at.isoformat(),
                "members": member_data,
                "admins": admin_ids,
                "member_count": len(member_data),
                "settings": settings_data,
                "current_user_role": current_member.role.value
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching group details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/groups/{group_id}/settings")
async def update_group_settings(
    group_id: UUID,
    settings: UpdateGroupSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update group settings (admin only)"""
    try:
        # Verify user is admin
        member_stmt = select(ConversationMember).where(
            ConversationMember.conversation_id == group_id,
            ConversationMember.user_id == current_user.id
        )
        member_result = await db.execute(member_stmt)
        member = member_result.scalar_one_or_none()

        if not member or member.role != MemberRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can modify group settings")

        # Get or create settings
        settings_stmt = select(GroupSettings).where(
            GroupSettings.conversation_id == group_id
        )
        settings_result = await db.execute(settings_stmt)
        group_settings = settings_result.scalar_one_or_none()

        if not group_settings:
            group_settings = GroupSettings(conversation_id=group_id)
            db.add(group_settings)

        # Update settings
        updated_fields = []
        if settings.only_admins_can_message is not None:
            group_settings.only_admins_can_message = settings.only_admins_can_message
            updated_fields.append("only_admins_can_message")

        if settings.only_admins_can_add_members is not None:
            group_settings.only_admins_can_add_members = settings.only_admins_can_add_members
            updated_fields.append("only_admins_can_add_members")

        if settings.send_message_notification is not None:
            group_settings.send_message_notification = settings.send_message_notification
            updated_fields.append("send_message_notification")

        await db.commit()
        await db.refresh(group_settings)

        return {
            "success": True,
            "message": f"Updated {len(updated_fields)} settings",
            "data": {
                "group_id": str(group_id),
                "settings": {
                    "only_admins_can_message": group_settings.only_admins_can_message,
                    "only_admins_can_add_members": group_settings.only_admins_can_add_members,
                    "send_message_notification": group_settings.send_message_notification
                },
                "updated_fields": updated_fields
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ Error updating group settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# USERS ENDPOINTS
# ============================================

@router.get("/users")
async def get_users(
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all users (excluding current user and blocked users)"""
    try:
        stmt = select(User).where(User.id != current_user.id)

        # Add search filter
        if search:
            stmt = stmt.where(
                or_(
                    User.username.ilike(f"%{search}%"),
                    User.email.ilike(f"%{search}%")
                )
            )

        stmt = stmt.limit(50)
        result = await db.execute(stmt)
        users = result.scalars().all()

        # ✅ Filter out blocked users
        blocked_stmt = select(BlockedUser.blocked_id).where(
            BlockedUser.blocker_id == current_user.id
        )
        blocked_result = await db.execute(blocked_stmt)
        blocked_ids = {row[0] for row in blocked_result.all()}

        response_data = [
            {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "avatar": user.avatar,
                "name": user.username
            }
            for user in users
            if user.id not in blocked_ids
        ]

        return {
            "success": True,
            "data": response_data,
            "message": "Users fetched successfully"
        }

    except Exception as e:
        print(f"❌ Error fetching users: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))