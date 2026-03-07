# # backend/app/websocket/routes.py

# import json
# import uuid
# import logging
# from datetime import datetime, timezone
# from fastapi import APIRouter, WebSocket, WebSocketDisconnect
# from sqlalchemy.ext.asyncio import AsyncSession
# from sqlalchemy import select

# from app.db.session import async_session_maker
# from app.websocket.manager import WSManager
# from app.websocket.auth import get_token_from_ws, verify_ws_token 
# from app.websocket.pubsub import PubSub
# from app.websocket.streams import RedisStreams
# from app.models.message import Message
# from app.models.message_receipt import MessageReceipt
# from app.models.conversation_member import ConversationMember
# from app.models.user import User

# router = APIRouter(prefix="/ws", tags=["WebSocket"])

# logger = logging.getLogger(__name__)

# # Initialize services
# manager = WSManager()
# pubsub = PubSub()
# streams = RedisStreams()

# ONLINE_SET_KEY = "papyris:online_users"


# async def publish_room(room_id: str, payload: dict):
#     """Publish event to a room via Redis Pub/Sub"""
#     await pubsub.publish({"roomId": room_id, "payload": payload})


# async def on_redis_event(evt: dict):
#     """Handle events from Redis Pub/Sub"""
#     room_id = evt.get("roomId")
#     payload = evt.get("payload")

#     if not payload:
#         return

#     # ✅ Handle global events (presence)
#     if room_id == "__global__":
#         # Broadcast to ALL connected users
#         for user_id, ws_set in manager.user_sockets.items():
#             for ws in ws_set:
#                 try:
#                     await ws.send_json(payload)
#                 except Exception as e:
#                     print(f"❌ Failed to send global event to {user_id}: {e}")
#     elif room_id:
#         # Regular room broadcast
#         await manager.broadcast_room(room_id, payload)


# @router.on_event("startup")
# async def _ws_start():
#     """Initialize Redis Streams and start Pub/Sub listener"""
#     await streams.init_stream()
#     pubsub.start(on_redis_event)
#     print("✅ WebSocket services started")


# @router.on_event("shutdown")
# async def _ws_stop():
#     """Cleanup on shutdown"""
#     await pubsub.stop()
#     await streams.close()
#     print("🛑 WebSocket services stopped")


# @router.websocket("/chat")
# async def ws_chat(ws: WebSocket):
#     """Main WebSocket endpoint for chat functionality"""
    
#     # 1. Authenticate
#     token = get_token_from_ws(ws)
#     if not token:
#         print("❌ [WS] Connection rejected: Missing token")
#         await ws.close(code=1008, reason="Missing token")
#         return

#     try:
#         user_id_str = verify_ws_token(token)  # ✅ This works from your auth.py
#         user_id = uuid.UUID(user_id_str)
#     except Exception as e:
#         print(f"❌ [WS] Auth failed: {e}")
#         await ws.close(code=1008, reason="Invalid token")
#         return

#     # 2. Accept connection
#     await manager.accept(ws)
#     manager.track_user(user_id_str, ws)

#     # 3. Mark user as online
#     async with pubsub.redis.pipeline() as p:
#         await p.sadd(ONLINE_SET_KEY, user_id_str)
#         await p.execute()

#     # ✅ Broadcast online to ALL users
#     online_payload = {"type": "online", "userId": user_id_str}
    
#     # Method 1: Direct send to all (more reliable)
#     for uid, ws_set in manager.user_sockets.items():
#         for user_ws in ws_set:
#             try:
#                 await user_ws.send_json(online_payload)
#                 print(f"📤 Sent online status to user {uid}")
#             except Exception as e:
#                 print(f"❌ Failed to send online to {uid}: {e}")

#     print(f"✅ [WS] User {user_id_str[:8]} connected and broadcast to {len(manager.user_sockets)} users")

#     try:
#         while True:
#             # Receive message from client
#             raw = await ws.receive_text()
#             data = json.loads(raw)
            
#             event_type = data.get("type")
#             room_id = data.get("roomId")

#             print(f"📥 [WS:{user_id_str[:8]}] Event: {event_type} | Room: {room_id[:8] if room_id else 'N/A'}")

#             # ===== JOIN ROOM =====
#             if event_type == "join" and room_id:
#                 async with async_session_maker() as db:
#                     is_member = await _check_membership(db, user_id, room_id)
#                     if not is_member:
#                         print(f"⚠️  [WS:{user_id_str[:8]}] Not member of {room_id[:8]}")
#                         await ws.send_json({
#                             "type": "error",
#                             "message": "Not a member of this conversation"
#                         })
#                         continue
                
#                 manager.join_room(room_id, ws)
#                 await ws.send_json({"type": "joined", "roomId": room_id})
#                 print(f"✅ [WS:{user_id_str[:8]}] Joined room {room_id[:8]}")
#                 continue

#             # ===== LEAVE ROOM =====
#             if event_type == "leave" and room_id:
#                 manager.room_sockets.get(room_id, set()).discard(ws)
#                 await ws.send_json({"type": "left", "roomId": room_id})
#                 print(f"📤 [WS:{user_id_str[:8]}] Left room {room_id[:8]}")
#                 continue

#             # ===== SEND MESSAGE =====
#             if event_type == "message" and room_id:
#                 text = (data.get("text") or "").strip()
#                 if not text:
#                     await ws.send_json({"type": "error", "message": "Empty message"})
#                     continue

#                 async with async_session_maker() as db:
#                     # Verify membership
#                     is_member = await _check_membership(db, user_id, room_id)
#                     if not is_member:
#                         print(f"⚠️  [WS:{user_id_str[:8]}] Can't send to {room_id[:8]} - not member")
#                         await ws.send_json({
#                             "type": "error",
#                             "message": "Not a member of this conversation"
#                         })
#                         continue

#                     # ✅ Get all conversation members
#                     members_stmt = select(ConversationMember.user_id).where(
#                         ConversationMember.conversation_id == uuid.UUID(room_id)
#                     )
#                     members_result = await db.execute(members_stmt)
#                     member_ids = [str(m) for m in members_result.scalars().all()]

#                     # Get sender info
#                     sender = await db.get(User, user_id)
#                     sender_name = sender.username if sender else "Unknown"
#                     sender_avatar = sender.avatar if sender else None

#                 # Generate message ID
#                 msg_id = str(uuid.uuid4())
                
#                 # Add to Redis Streams for persistence
#                 await streams.add_message({
#                     "messageId": msg_id,
#                     "conversationId": room_id,
#                     "senderId": user_id_str,
#                     "text": text,
#                     "timestamp": datetime.now(timezone.utc).isoformat()
#                 })

#                 # ✅ Build payload with sender info
#                 payload = {
#                     "type": "message",
#                     "roomId": room_id,
#                     "messageId": msg_id,
#                     "senderId": user_id_str,
#                     "senderName": sender_name,
#                     "senderAvatar": sender_avatar,
#                     "text": text,
#                     "timestamp": datetime.now(timezone.utc).isoformat(),
#                     "status": "sent"
#                 }

#                 # ✅ CRITICAL: Send to ALL MEMBERS (not just room)
#                 # This ensures users receive messages even when viewing different chats
#                 sent_count = 0
#                 for member_id in member_ids:
#                     if member_id in manager.user_sockets:
#                         for member_ws in manager.user_sockets[member_id]:
#                             try:
#                                 await member_ws.send_json(payload)
#                                 sent_count += 1
#                                 print(f"💬 [WS] Sent message to member {member_id[:8]}")
#                             except Exception as e:
#                                 print(f"❌ Failed to send to {member_id[:8]}: {e}")
#                     else:
#                         print(f"⚠️  [WS] Member {member_id[:8]} not connected")

#                 print(f"✅ [WS] Message {msg_id[:8]} delivered to {sent_count}/{len(member_ids)} members")
#                 continue

#             # ===== TYPING INDICATOR =====
#             if event_type == "typing" and room_id:
#                 is_typing = data.get("isTyping", False)
                
#                 async with async_session_maker() as db:
#                     is_member = await _check_membership(db, user_id, room_id)
#                     if not is_member:
#                         continue

#                 payload = {
#                     "type": "typing",
#                     "roomId": room_id,
#                     "userId": user_id_str,
#                     "isTyping": is_typing
#                 }
#                 await publish_room(room_id, payload)
#                 print(f"⌨️  [WS:{user_id_str[:8]}] Typing: {is_typing} in {room_id[:8]}")
#                 continue

#             # ===== READ RECEIPT =====
#             if event_type == "read" and room_id:
#                 last_msg_id = data.get("lastMessageId")
                
#                 # Skip temp messages
#                 if last_msg_id and last_msg_id.startswith('temp-'):
#                     print(f"⏭️  [WS:{user_id_str[:8]}] Skipping temp message read receipt")
#                     continue
                
#                 async with async_session_maker() as db:
#                     await _mark_read(db, user_id, room_id, last_msg_id)

#                 payload = {
#                     "type": "read",
#                     "roomId": room_id,
#                     "userId": user_id_str,
#                     "lastMessageId": last_msg_id
#                 }
#                 await publish_room(room_id, payload)
#                 print(f"📖 [WS:{user_id_str[:8]}] Marked {last_msg_id[:8]} as read")
#                 continue

#             # ===== PING =====
#             if event_type == "ping":
#                 await ws.send_json({"type": "pong"})
#                 continue

#             # Unknown event
#             print(f"⚠️  [WS:{user_id_str[:8]}] Unknown event: {event_type}")

#     except WebSocketDisconnect:
#         print(f"🔌 [WS:{user_id_str[:8]}] Disconnected normally")
#     except Exception as e:
#         print(f"❌ [WS:{user_id_str[:8]}] Error: {e}")
#         import traceback
#         traceback.print_exc()
#     finally:
#         # Cleanup
#         manager.untrack(user_id_str, ws)
#         await pubsub.redis.srem(ONLINE_SET_KEY, user_id_str)

#         # ✅ Broadcast offline to ALL users
#         offline_payload = {"type": "offline", "userId": user_id_str}
        
#         offline_count = 0
#         for uid, ws_set in manager.user_sockets.items():
#             for user_ws in ws_set:
#                 try:
#                     await user_ws.send_json(offline_payload)
#                     offline_count += 1
#                 except Exception as e:
#                     print(f"❌ Failed to send offline to {uid[:8]}: {e}")
        
#         print(f"👋 [WS:{user_id_str[:8]}] Offline broadcast sent to {offline_count} users")


# # ========== Helper Functions ==========

# async def _check_membership(db: AsyncSession, user_id: uuid.UUID, conversation_id: str) -> bool:
#     """Check if user is a member of the conversation"""
#     try:
#         conv_uuid = uuid.UUID(conversation_id)
#         result = await db.execute(
#             select(ConversationMember).where(
#                 ConversationMember.conversation_id == conv_uuid,
#                 ConversationMember.user_id == user_id
#             )
#         )
#         return result.scalar_one_or_none() is not None
#     except Exception as e:
#         print(f"❌ Membership check error: {e}")
#         return False


# async def _mark_read(
#     db: AsyncSession, 
#     user_id: uuid.UUID, 
#     conversation_id: str, 
#     last_message_id: str | None
# ) -> None:
#     """Mark message as read"""
#     if not last_message_id:
#         return

#     # Skip temporary messages
#     if last_message_id.startswith('temp-'):
#         return

#     try:
#         msg_uuid = uuid.UUID(last_message_id)
        
#         # Get or create receipt
#         result = await db.execute(
#             select(MessageReceipt).where(
#                 MessageReceipt.message_id == msg_uuid,
#                 MessageReceipt.user_id == user_id
#             )
#         )
#         receipt = result.scalar_one_or_none()
        
#         if receipt:
#             receipt.status = "read"
#             receipt.read_at = datetime.now(timezone.utc)
#         else:
#             receipt = MessageReceipt(
#                 message_id=msg_uuid,
#                 user_id=user_id,
#                 status="read",
#                 read_at=datetime.now(timezone.utc)
#             )
#             db.add(receipt)
        
#         await db.commit()
#         print(f"✅ Message {last_message_id[:8]} marked read by {user_id}")
        
#     except Exception as e:
#         print(f"❌ Mark read error: {e}")
#         await db.rollback()


# backend/app/websocket/routes.py
"""
WebSocket routes — updated to work with PubSub that may use in-memory fallback.
Key fix: replaced `pubsub.redis.pipeline()` / `pubsub.redis.srem()` with safe helpers.
"""

import json
import uuid
import logging
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
from app.models.user import User

router = APIRouter(prefix="/ws", tags=["WebSocket"])
logger = logging.getLogger(__name__)

# ── Service instances ─────────────────────────────────────────────────────
manager = WSManager()
pubsub = PubSub()
streams = RedisStreams()

# In-memory online users set (used when Redis is unavailable)
_online_users_local: set = set()
ONLINE_SET_KEY = "papyris:online_users"


# ── Redis-safe helpers ────────────────────────────────────────────────────

async def _sadd_online(user_id: str) -> None:
    """Mark user as online — tries Redis, falls back to local set."""
    _online_users_local.add(user_id)
    if pubsub.redis:
        try:
            await pubsub.redis.sadd(ONLINE_SET_KEY, user_id)
        except Exception:
            pass  # local set already updated


async def _srem_online(user_id: str) -> None:
    """Mark user as offline."""
    _online_users_local.discard(user_id)
    if pubsub.redis:
        try:
            await pubsub.redis.srem(ONLINE_SET_KEY, user_id)
        except Exception:
            pass


async def publish_room(room_id: str, payload: dict) -> None:
    """Publish event to a room via PubSub (Redis or in-memory)."""
    await pubsub.publish({"roomId": room_id, "payload": payload})


async def on_redis_event(evt: dict) -> None:
    """Handle incoming PubSub events (Redis or in-memory)."""
    room_id = evt.get("roomId")
    payload = evt.get("payload")

    if not payload:
        return

    if room_id == "__global__":
        for uid, ws_set in manager.user_sockets.items():
            for ws in ws_set:
                try:
                    await ws.send_json(payload)
                except Exception as e:
                    logger.debug(f"Failed to send global event to {uid}: {e}")
    elif room_id:
        await manager.broadcast_room(room_id, payload)


# ── Startup / Shutdown ────────────────────────────────────────────────────

@router.on_event("startup")
async def _ws_start():
    await streams.init_stream()
    pubsub.start(on_redis_event)
    mode = "Redis" if not pubsub._using_fallback else "in-memory fallback"
    print(f"✅ WebSocket services started ({mode})")


@router.on_event("shutdown")
async def _ws_stop():
    await pubsub.stop()
    await streams.close()
    print("🛑 WebSocket services stopped")


# ── Main WebSocket endpoint ───────────────────────────────────────────────

@router.websocket("/chat")
async def ws_chat(ws: WebSocket):
    """Main WebSocket endpoint for chat."""

    # 1. Authenticate
    token = get_token_from_ws(ws)
    if not token:
        await ws.close(code=1008, reason="Missing token")
        return

    try:
        user_id_str = verify_ws_token(token)
        user_id = uuid.UUID(user_id_str)
    except Exception as e:
        logger.error(f"WS auth failed: {e}")
        await ws.close(code=1008, reason="Invalid token")
        return

    # 2. Accept & track
    await manager.accept(ws)
    manager.track_user(user_id_str, ws)
    await _sadd_online(user_id_str)

    # 3. Broadcast online to all
    online_payload = {"type": "online", "userId": user_id_str}
    for uid, ws_set in manager.user_sockets.items():
        for user_ws in ws_set:
            try:
                await user_ws.send_json(online_payload)
            except Exception:
                pass

    logger.info(f"✅ [WS] User {user_id_str[:8]} connected")

    try:
        while True:
            raw = await ws.receive_text()
            data = json.loads(raw)
            event_type = data.get("type")
            room_id = data.get("roomId")

            # ── JOIN ──
            if event_type == "join" and room_id:
                async with async_session_maker() as db:
                    if not await _check_membership(db, user_id, room_id):
                        await ws.send_json({"type": "error", "message": "Not a member"})
                        continue
                manager.join_room(room_id, ws)
                await ws.send_json({"type": "joined", "roomId": room_id})
                continue

            # ── LEAVE ──
            if event_type == "leave" and room_id:
                manager.room_sockets.get(room_id, set()).discard(ws)
                await ws.send_json({"type": "left", "roomId": room_id})
                continue

            # ── MESSAGE ──
            if event_type == "message" and room_id:
                text = (data.get("text") or "").strip()
                if not text:
                    await ws.send_json({"type": "error", "message": "Empty message"})
                    continue

                async with async_session_maker() as db:
                    if not await _check_membership(db, user_id, room_id):
                        await ws.send_json({"type": "error", "message": "Not a member"})
                        continue

                    # Get all member IDs for fan-out
                    members_result = await db.execute(
                        select(ConversationMember.user_id).where(
                            ConversationMember.conversation_id == uuid.UUID(room_id)
                        )
                    )
                    member_ids = [str(m) for m in members_result.scalars().all()]

                    # Sender info
                    sender = await db.get(User, user_id)
                    sender_name = sender.username if sender else "Unknown"
                    sender_avatar = getattr(sender, "avatar", None)

                    # Persist to DB
                    msg = Message(
                        conversation_id=uuid.UUID(room_id),
                        sender_id=user_id,
                        text=text,
                    )
                    db.add(msg)
                    await db.commit()
                    await db.refresh(msg)
                    msg_id = str(msg.id)

                # Add to streams
                await streams.add_message({
                    "messageId": msg_id,
                    "conversationId": room_id,
                    "senderId": user_id_str,
                    "text": text,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

                payload = {
                    "type": "message",
                    "roomId": room_id,
                    "messageId": msg_id,
                    "senderId": user_id_str,
                    "senderName": sender_name,
                    "senderAvatar": sender_avatar,
                    "text": text,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "status": "sent",
                }

                # Fan-out to all connected members
                sent = 0
                for mid in member_ids:
                    for mws in manager.user_sockets.get(mid, set()):
                        try:
                            await mws.send_json(payload)
                            sent += 1
                        except Exception:
                            pass

                logger.info(f"💬 Message {msg_id[:8]} delivered to {sent}/{len(member_ids)} members")
                continue

            # ── TYPING ──
            if event_type == "typing" and room_id:
                is_typing = data.get("isTyping", False)
                async with async_session_maker() as db:
                    if not await _check_membership(db, user_id, room_id):
                        continue
                payload = {
                    "type": "typing",
                    "roomId": room_id,
                    "userId": user_id_str,
                    "isTyping": is_typing,
                }
                await publish_room(room_id, payload)
                continue

            # ── READ ──
            if event_type == "read" and room_id:
                last_msg_id = data.get("lastMessageId")
                if last_msg_id and not last_msg_id.startswith("temp-"):
                    async with async_session_maker() as db:
                        await _mark_read(db, user_id, room_id, last_msg_id)
                    await publish_room(room_id, {
                        "type": "read",
                        "roomId": room_id,
                        "userId": user_id_str,
                        "lastMessageId": last_msg_id,
                    })
                continue

            # ── PING ──
            if event_type == "ping":
                await ws.send_json({"type": "pong"})
                continue

    except WebSocketDisconnect:
        logger.info(f"🔌 User {user_id_str[:8]} disconnected")
    except Exception as e:
        logger.error(f"❌ WS error for {user_id_str[:8]}: {e}")
    finally:
        manager.untrack(user_id_str, ws)
        await _srem_online(user_id_str)

        offline_payload = {"type": "offline", "userId": user_id_str}
        for uid, ws_set in manager.user_sockets.items():
            for user_ws in ws_set:
                try:
                    await user_ws.send_json(offline_payload)
                except Exception:
                    pass


# ── Helpers ───────────────────────────────────────────────────────────────

async def _check_membership(db: AsyncSession, user_id: uuid.UUID, conversation_id: str) -> bool:
    try:
        result = await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == uuid.UUID(conversation_id),
                ConversationMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none() is not None
    except Exception as e:
        logger.error(f"Membership check error: {e}")
        return False


async def _mark_read(
    db: AsyncSession, user_id: uuid.UUID, conversation_id: str, last_message_id: str
) -> None:
    if not last_message_id or last_message_id.startswith("temp-"):
        return
    try:
        msg_uuid = uuid.UUID(last_message_id)
        result = await db.execute(
            select(MessageReceipt).where(
                MessageReceipt.message_id == msg_uuid,
                MessageReceipt.user_id == user_id,
            )
        )
        receipt = result.scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if receipt:
            receipt.status = "read"
            receipt.read_at = now
        else:
            db.add(MessageReceipt(
                message_id=msg_uuid,
                user_id=user_id,
                status="read",
                read_at=now,
            ))
        await db.commit()
    except Exception as e:
        logger.error(f"Mark read error: {e}")
        await db.rollback()