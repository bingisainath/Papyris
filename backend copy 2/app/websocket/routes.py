# backend/app/websocket/routes.py

import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import async_session_maker
from app.websocket.manager import WSManager
from app.websocket.auth import get_token_from_ws, verify_ws_token
from app.websocket.pubsub import PubSub
from app.websocket.streams import RedisStreams
from app.models.message import Message
from app.models.message_receipt import MessageReceipt
from app.models.conversation_member import ConversationMember

router = APIRouter(prefix="/ws", tags=["WebSocket"])

# Initialize services
manager = WSManager()
pubsub = PubSub()
streams = RedisStreams()

ONLINE_SET_KEY = "papyris:online_users"


async def publish_room(room_id: str, payload: dict):
    """Publish event to a room via Redis Pub/Sub"""
    await pubsub.publish({"roomId": room_id, "payload": payload})


async def on_redis_event(evt: dict):
    """Handle events from Redis Pub/Sub"""
    room_id = evt.get("roomId")
    payload = evt.get("payload")
    if room_id and payload:
        await manager.broadcast_room(room_id, payload)


@router.on_event("startup")
async def _ws_start():
    """Initialize Redis Streams and start Pub/Sub listener"""
    await streams.init_stream()
    pubsub.start(on_redis_event)
    print("✅ WebSocket services started")


@router.on_event("shutdown")
async def _ws_stop():
    """Cleanup on shutdown"""
    await pubsub.stop()
    await streams.close()
    print("🛑 WebSocket services stopped")


@router.websocket("/chat")
async def ws_chat(ws: WebSocket):
    """
    Main WebSocket endpoint for chat functionality.
    
    Events sent by client:
    - join: {"type": "join", "roomId": "conv_id"}
    - leave: {"type": "leave", "roomId": "conv_id"}
    - message: {"type": "message", "roomId": "conv_id", "text": "hello"}
    - typing: {"type": "typing", "roomId": "conv_id", "isTyping": true}
    - read: {"type": "read", "roomId": "conv_id", "lastMessageId": "msg_id"}
    
    Events sent to client:
    - joined: {"type": "joined", "roomId": "conv_id"}
    - left: {"type": "left", "roomId": "conv_id"}
    - message: {"type": "message", "roomId": "conv_id", "messageId": "...", "senderId": "...", ...}
    - typing: {"type": "typing", "roomId": "conv_id", "userId": "...", "isTyping": true}
    - read: {"type": "read", "roomId": "conv_id", "userId": "...", "lastMessageId": "..."}
    - online: {"type": "online", "userId": "..."}
    - offline: {"type": "offline", "userId": "..."}
    """
    
    # 1. Authenticate
    token = get_token_from_ws(ws)
    if not token:
        await ws.close(code=1008, reason="Missing token")
        return

    try:
        user_id_str = verify_ws_token(token)
        user_id = uuid.UUID(user_id_str)  # Convert to UUID
    except Exception as e:
        print(f"❌ Auth failed: {e}")
        await ws.close(code=1008, reason="Invalid token")
        return

    # 2. Accept connection
    await manager.accept(ws)
    manager.track_user(user_id_str, ws)

    # 3. Mark user as online
    async with pubsub.redis.pipeline() as p:
        await p.sadd(ONLINE_SET_KEY, user_id_str)
        await p.execute()
    
    # Broadcast online status
    await pubsub.publish({
        "roomId": "__presence__",
        "payload": {"type": "online", "userId": user_id_str}
    })

    print(f"✅ User {user_id_str} connected")

    try:
        while True:
            # Receive message from client
            raw = await ws.receive_text()
            data = json.loads(raw)
            
            t = data.get("type")
            room_id = data.get("roomId")

            # JOIN ROOM
            if t == "join" and room_id:
                # Verify user is member of this conversation
                async with async_session_maker() as db:
                    is_member = await _check_membership(db, user_id, room_id)
                    if not is_member:
                        await ws.send_json({
                            "type": "error",
                            "message": "Not a member of this conversation"
                        })
                        continue
                
                manager.join_room(room_id, ws)
                await ws.send_json({"type": "joined", "roomId": room_id})
                print(f"📥 User {user_id_str} joined room {room_id}")
                continue

            # LEAVE ROOM
            if t == "leave" and room_id:
                manager.room_sockets.get(room_id, set()).discard(ws)
                await ws.send_json({"type": "left", "roomId": room_id})
                print(f"📤 User {user_id_str} left room {room_id}")
                continue

            # SEND MESSAGE
            if t == "message" and room_id:
                text = (data.get("text") or "").strip()
                if not text:
                    await ws.send_json({"type": "error", "message": "Empty message"})
                    continue

                # Verify membership
                async with async_session_maker() as db:
                    is_member = await _check_membership(db, user_id, room_id)
                    if not is_member:
                        await ws.send_json({
                            "type": "error",
                            "message": "Not a member of this conversation"
                        })
                        continue

                # Add to Redis Streams for background persistence
                msg_id = str(uuid.uuid4())
                await streams.add_message({
                    "messageId": msg_id,
                    "conversationId": room_id,
                    "senderId": user_id_str,
                    "text": text,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

                # Broadcast immediately via Pub/Sub
                payload = {
                    "type": "message",
                    "roomId": room_id,
                    "messageId": msg_id,
                    "senderId": user_id_str,
                    "text": text,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "status": "sent"
                }
                await publish_room(room_id, payload)
                
                print(f"💬 Message {msg_id} from {user_id_str} in room {room_id}")
                continue

            # TYPING INDICATOR
            if t == "typing" and room_id:
                is_typing = data.get("isTyping", False)
                
                # Verify membership
                async with async_session_maker() as db:
                    is_member = await _check_membership(db, user_id, room_id)
                    if not is_member:
                        continue

                payload = {
                    "type": "typing",
                    "roomId": room_id,
                    "userId": user_id_str,
                    "isTyping": is_typing
                }
                await publish_room(room_id, payload)
                continue

            # READ RECEIPT
            if t == "read" and room_id:
                last_msg_id = data.get("lastMessageId")
                
                async with async_session_maker() as db:
                    await _mark_read(db, user_id, room_id, last_msg_id)

                payload = {
                    "type": "read",
                    "roomId": room_id,
                    "userId": user_id_str,
                    "lastMessageId": last_msg_id
                }
                await publish_room(room_id, payload)
                continue

            # Unknown event
            await ws.send_json({"type": "error", "message": "Invalid event type"})

    except WebSocketDisconnect:
        print(f"🔌 User {user_id_str} disconnected normally")
    except Exception as e:
        print(f"❌ Error for user {user_id_str}: {e}")
    finally:
        # Cleanup
        manager.untrack(user_id_str, ws)
        await pubsub.redis.srem(ONLINE_SET_KEY, user_id_str)
        
        # Broadcast offline status
        await pubsub.publish({
            "roomId": "__presence__",
            "payload": {"type": "offline", "userId": user_id_str}
        })
        
        print(f"👋 User {user_id_str} cleaned up")


# ========== Helper Functions ==========

async def _check_membership(db: AsyncSession, user_id: uuid.UUID, conversation_id: str) -> bool:
    """Check if user is a member of the conversation"""
    result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id
        )
    )
    return result.scalar_one_or_none() is not None


async def _persist_message(
    db: AsyncSession, 
    message_id: str,
    conversation_id: str, 
    sender_id: uuid.UUID, 
    text: str
) -> None:
    """Persist message to database"""
    msg = Message(
        id=message_id,
        conversation_id=conversation_id,
        sender_id=sender_id,
        text=text,
        status="sent"
    )
    db.add(msg)
    await db.commit()
    print(f"💾 Message {message_id} persisted to database")


async def _mark_read(
    db: AsyncSession, 
    user_id: uuid.UUID, 
    conversation_id: str, 
    last_message_id: str | None
) -> None:
    """Mark message as read"""
    if not last_message_id:
        return
    
    # Check if receipt already exists
    result = await db.execute(
        select(MessageReceipt).where(
            MessageReceipt.message_id == last_message_id,
            MessageReceipt.user_id == user_id
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        # Update to read status
        existing.status = "read"
        existing.read_at = datetime.now(timezone.utc)
    else:
        # Create new receipt
        receipt = MessageReceipt(
            message_id=last_message_id,
            user_id=user_id,
            status="read",
            read_at=datetime.now(timezone.utc)
        )
        db.add(receipt)
    
    await db.commit()
    print(f"✅ Message {last_message_id} marked as read by {user_id}")