# import json
# from fastapi import APIRouter, WebSocket, WebSocketDisconnect
# from app.websocket.manager import ConnectionManager

# router = APIRouter(prefix="/ws", tags=["WebSocket"])
# manager = ConnectionManager()


# @router.websocket("/ping")
# async def ws_ping(ws: WebSocket):
#     """
#     Basic echo test: send any text -> gets 'echo: <text>'
#     """
#     await manager.connect(ws)
#     try:
#         while True:
#             msg = await ws.receive_text()
#             await ws.send_text(f"echo: {msg}")
#     except WebSocketDisconnect:
#         manager.disconnect(ws)


# @router.websocket("/chat")
# async def ws_chat(ws: WebSocket):
#     """
#     Rooms-based chat:
#     - join:    { "type": "join", "roomId": "dm:1:2" }
#     - leave:   { "type": "leave", "roomId": "dm:1:2" }
#     - message: { "type": "message", "roomId": "dm:1:2", "text": "hi" }
#     """
#     await manager.connect(ws)

#     try:
#         while True:
#             raw = await ws.receive_text()
#             data = json.loads(raw)

#             msg_type = data.get("type")
#             room_id = data.get("roomId")

#             if msg_type == "join" and room_id:
#                 manager.join(room_id, ws)
#                 await ws.send_json({"type": "joined", "roomId": room_id})
#                 continue

#             if msg_type == "leave" and room_id:
#                 manager.leave(room_id, ws)
#                 await ws.send_json({"type": "left", "roomId": room_id})
#                 continue

#             if msg_type == "message" and room_id:
#                 text = (data.get("text") or "").strip()
#                 if not text:
#                     await ws.send_json({"type": "error", "message": "Empty message"})
#                     continue

#                 await manager.broadcast(room_id, {
#                     "type": "message",
#                     "roomId": room_id,
#                     "text": text,
#                 })
#                 continue

#             await ws.send_json({"type": "error", "message": "Invalid event"})
#     except WebSocketDisconnect:
#         manager.disconnect(ws)
#     except Exception as e:
#         manager.disconnect(ws)
#         try:
#             await ws.close()
#         except Exception:
#             pass


import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_maker
from app.websocket.manager import WSManager
from app.websocket.auth import get_token_from_ws, verify_ws_token
from app.websocket.pubsub import PubSub

router = APIRouter(prefix="/ws", tags=["WebSocket"])
manager = WSManager()
pubsub = PubSub()

ONLINE_SET_KEY = "papyris:online_users"

async def publish_room(room_id: str, payload: dict):
    await pubsub.publish({"roomId": room_id, "payload": payload})

async def on_redis_event(evt: dict):
    room_id = evt.get("roomId")
    payload = evt.get("payload")
    if room_id and payload:
        await manager.broadcast_room(room_id, payload)

@router.on_event("startup")
async def _ws_start():
    pubsub.start(on_redis_event)

@router.websocket("/chat")
async def ws_chat(ws: WebSocket):
    token = get_token_from_ws(ws)
    if not token:
        await ws.close(code=1008)
        return

    try:
        user_id = verify_ws_token(token)
    except Exception:
        await ws.close(code=1008)
        return

    await manager.accept(ws)
    manager.track_user(user_id, ws)

    # online presence (per-instance)
    # For multi-instance: keep a Redis set + publish online updates similarly.
    async with pubsub.redis.pipeline() as p:
        await p.sadd(ONLINE_SET_KEY, user_id)
        await p.execute()

    try:
        await pubsub.publish({"roomId": "__presence__", "payload": {"type": "online", "userId": user_id}})

        while True:
            raw = await ws.receive_text()
            data = json.loads(raw)

            t = data.get("type")
            room_id = data.get("roomId")

            # JOIN room
            if t == "join" and room_id:
                # TODO production: validate membership in DB before joining
                manager.join_room(room_id, ws)
                await ws.send_json({"type": "joined", "roomId": room_id})
                continue

            # TYPING
            if t == "typing" and room_id:
                payload = {"type": "typing", "roomId": room_id, "userId": user_id, "isTyping": bool(data.get("isTyping"))}
                await publish_room(room_id, payload)
                continue

            # MESSAGE
            if t == "message" and room_id:
                text = (data.get("text") or "").strip()
                if not text:
                    await ws.send_json({"type": "error", "message": "Empty message"})
                    continue

                # Persist message in DB
                async with async_session_maker() as db:  # AsyncSession
                    msg_id = await _persist_message(db, room_id, user_id, text)

                payload = {"type": "message", "roomId": room_id, "id": msg_id, "text": text, "senderId": user_id}
                await publish_room(room_id, payload)
                continue

            # READ RECEIPT
            if t == "read" and room_id:
                last_id = data.get("lastMessageId")
                async with async_session_maker() as db:
                    await _mark_read(db, user_id, room_id, last_id)

                payload = {"type": "read", "roomId": room_id, "userId": user_id, "lastMessageId": last_id}
                await publish_room(room_id, payload)
                continue

            await ws.send_json({"type": "error", "message": "Invalid event"})

    except WebSocketDisconnect:
        pass
    finally:
        manager.untrack(user_id, ws)
        await pubsub.redis.srem(ONLINE_SET_KEY, user_id)
        await pubsub.publish({"roomId": "__presence__", "payload": {"type": "offline", "userId": user_id}})


# ---------- DB helpers (keep in services in real code) ----------
import uuid
from app.models.message import Message, MessageReceipt
from sqlalchemy import select

async def _persist_message(db: AsyncSession, conversation_id: str, sender_id: str, text: str) -> str:
    msg_id = str(uuid.uuid4())
    db.add(Message(id=msg_id, conversation_id=conversation_id, sender_id=sender_id, text=text))
    await db.commit()
    return msg_id

async def _mark_read(db: AsyncSession, user_id: str, conversation_id: str, last_message_id: str | None):
    # simplest: mark receipt for last_message_id only
    if not last_message_id:
        return
    exists = await db.execute(select(MessageReceipt).where(
        MessageReceipt.message_id == last_message_id,
        MessageReceipt.user_id == user_id
    ))
    if exists.scalar_one_or_none() is None:
        db.add(MessageReceipt(message_id=last_message_id, user_id=user_id))
        await db.commit()
