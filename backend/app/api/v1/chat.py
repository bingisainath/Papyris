# backend/app/api/v1/chat.py 

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID

from app.db.session import get_db
from app.models.user import User
# from app.models.conversation import Conversation, ConversationMember

from app.models.conversation import Conversation
from app.models.conversation_member import ConversationMember

from app.models.message import Message
from app.api.dependencies import get_current_user
from pydantic import BaseModel
from datetime import datetime, timezone

router = APIRouter()


# Request/Response Models
class CreateConversationRequest(BaseModel):
    kind: str  # 'dm' or 'group'
    title: Optional[str] = None
    participant_ids: List[str]

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
            # ✅ Get all member IDs (just IDs, not full objects)
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

            # ✅ ADD DETAILED DEBUG LOGGING
            print(f"\n{'='*60}")
            print(f"📊 Processing conversation: {conv.id}")
            print(f"   Name/Title: {conv.title if conv.kind == 'group' else 'DM'}")

            # ✅ CALCULATE REAL UNREAD COUNT
            # Get user's last_read_message_id from conversation_members
            member_stmt = select(ConversationMember).where(
                ConversationMember.conversation_id == conv.id,
                ConversationMember.user_id == current_user.id
            )
            member_result = await db.execute(member_stmt)
            member = member_result.scalar_one_or_none()

            if member:
                print(f"   User's last_read_message_id: {member.last_read_message_id}")
            else:
                print(f"   ⚠️ User is not a member!")
            
            # Count total messages
            total_msg_stmt = select(func.count(Message.id)).where(
                Message.conversation_id == conv.id
            )
            total_result = await db.execute(total_msg_stmt)
            total_messages = total_result.scalar() or 0
            print(f"   Total messages: {total_messages}")

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
                        # Count messages created after last read message
                        unread_stmt = select(func.count(Message.id)).where(
                            Message.conversation_id == conv.id,
                            Message.created_at > last_read_msg.created_at,
                            Message.sender_id != current_user.id  # Don't count own messages
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

            print(f"📊 Conversation {conv.id}: unread_count = {unread_count}")

            # ✅ Get other user for DM (to get name and avatar)
            other_user = None
            if conv.kind == 'dm':
                # Find the other user (not current user)
                other_user_id = next((uid for uid in member_ids if uid != str(current_user.id)), None)
                if other_user_id:
                    user_stmt = select(User).where(User.id == UUID(other_user_id))
                    user_result = await db.execute(user_stmt)
                    other_user = user_result.scalar_one_or_none()

            # ✅ Format response to match frontend expectations
            conv_data = {
                "id": str(conv.id),
                "name": other_user.username if other_user else (conv.title or "Unknown"),
                "avatar": other_user.avatar if other_user else conv.avatar_url,
                "lastMessage": last_message.text if last_message else "",
                "lastMessageTime": last_message.created_at.isoformat() if last_message else None,
                "unreadCount": unread_count, 
                "isOnline": False,  # Will be updated by frontend based on online users
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


# GET /api/v1/conversations/:id/messages - Get messages
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
        member_stmt = (
            select(ConversationMember)
            .where(
                and_(
                    ConversationMember.conversation_id == conversation_id,
                    ConversationMember.user_id == current_user.id
                )
            )
        )
        member_result = await db.execute(member_stmt)
        member = member_result.scalar_one_or_none()

        if not member:
            raise HTTPException(
                status_code=403,
                detail="Not a member of this conversation"
            )

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

            msg_data = {
                "id": str(msg.id),
                "conversation_id": str(msg.conversation_id),
                "sender_id": str(msg.sender_id),
                "text": msg.text,
                "created_at": msg.created_at.isoformat(),
                "status": "delivered",  # Default status
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


# backend/app/api/v1/chat.py - ADD MARK AS READ ENDPOINT

@router.post("/conversations/{conversation_id}/mark-read")
async def mark_conversation_read(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all messages in conversation as read up to the latest message"""
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
            await db.commit()

            print(f"✅ Marked conversation {conversation_id} as read for user {current_user.id}")

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


# POST /api/v1/conversations - Create new conversation
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
            raise HTTPException(
                status_code=400,
                detail="Kind must be 'dm' or 'group'"
            )

        # For DM, check if conversation already exists
        if request.kind == 'dm':
            if len(request.participant_ids) != 1:
                raise HTTPException(
                    status_code=400,
                    detail="DM must have exactly 1 other participant"
                )

            other_user_id = UUID(request.participant_ids[0])

            # Check if DM already exists between these two users
            # This is a bit complex - we need to find conversations where
            # both users are members and it's a DM
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

        from app.models.conversation_member import MemberRole

        # Add current user as member
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


# GET /api/v1/users - List users
@router.get("/users")
async def get_users(
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all users (excluding current user)"""
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

        response_data = [
            {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "avatar": user.avatar,
                "name": user.username  # Use username as name
            }
            for user in users
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