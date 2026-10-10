# backend/app/worker.py

import asyncio
import json
import uuid
from datetime import datetime, timezone

import logging

from app.core.logging import setup_logging
from app.db.session import async_session_maker
from app.websocket.streams import RedisStreams
from app.models.conversation import Conversation
from app.models.message import Message, MessageType
from app.models.message_receipt import MessageReceipt
from app.models.conversation_member import ConversationMember
from sqlalchemy import select, update

from app.config.settings import settings
from app.services import media_storage, push

logger = logging.getLogger("app.worker")


class MessageWorker:
    def __init__(self):
        self.streams = RedisStreams()
        self.consumer_name = f"worker-{uuid.uuid4().hex[:8]}"
        self.running = False

    async def start(self):
        """Start the worker"""
        logger.info("Starting message worker %s", self.consumer_name)
        await self.streams.init_stream()
        self.running = True
        
        try:
            await self.consume_loop()
        except KeyboardInterrupt:
            logger.info("Interrupted")
        finally:
            await self.stop()

    async def stop(self):
        """Stop the worker"""
        logger.info("Stopping message worker")
        self.running = False
        await self.streams.close()

    async def consume_loop(self):
        """Main consumption loop"""
        logger.info("Listening for messages")
        
        while self.running:
            try:
                results = await self.streams.read_messages(
                    consumer_name=self.consumer_name,
                    count=10,
                    block=5000
                )
                
                if not results:
                    continue
                
                for stream_name, messages in results:
                    for msg_id, fields in messages:
                        try:
                            # ✅ FIX: msg_id is already a string, no .decode() needed
                            await self.process_message(msg_id, fields)
                        except Exception:
                            logger.exception("Failed to process stream entry %s (will retry)", msg_id)
                        
            except Exception:
                logger.exception("Error in consume loop")
                await asyncio.sleep(1)

    async def notify(self, db, message: Message, data: dict, recipient_ids: list) -> None:
        """Push "Alice: see you at 8" (DM) or "Flat 4B / Alice: ..." (group) to the other members' phones."""
        if not push.enabled() or not recipient_ids:
            return
        conversation = await db.get(Conversation, message.conversation_id)
        sender = data.get("senderName") or "Someone"
        if settings.PUSH_SHOW_MESSAGE_TEXT:
            preview = media_storage.preview_text(message.message_type.value, message.text, message.media_filename)
        else:
            preview = "New message"
        if conversation is not None and conversation.kind == "group":
            title, body = conversation.title or "Group", f"{sender}: {preview}"
        else:
            title, body = sender, preview
        await push.send_to_users(db, recipient_ids, title, body, {
            "type": "message",
            "conversationId": str(message.conversation_id),
            "messageId": str(message.id),
        })

    async def process_message(self, msg_id: str, fields: dict):
        """Process a single message from the stream"""
        # ✅ FIX: fields is already decoded, no .decode() needed
        data_json = fields.get('data', '{}')
        data = json.loads(data_json)
        
        message_id = data.get('messageId')
        conversation_id = data.get('conversationId')
        sender_id_str = data.get('senderId')
        text = data.get('text') or ''
        media_type = data.get('mediaType')
        media_url = data.get('mediaUrl')
        
        if not all([message_id, conversation_id, sender_id_str]) or not (text or media_url):
            logger.warning("Dropping invalid stream entry %s: missing fields", msg_id)
            await self.streams.ack_message(msg_id)
            return
        
        logger.debug("Processing message %s from %s", message_id, sender_id_str)
        
        async with async_session_maker() as db:
            try:
                # ✅ Convert to UUIDs
                sender_id = uuid.UUID(sender_id_str)
                message_uuid = uuid.UUID(message_id)
                conversation_uuid = uuid.UUID(conversation_id)
                
                # Check if message already exists
                result = await db.execute(
                    select(Message).where(Message.id == message_uuid)
                )
                if result.scalar_one_or_none():
                    logger.debug("Message %s already saved, skipping", message_id)
                    await self.streams.ack_message(msg_id)
                    return
                
                timestamp_str = data.get('timestamp')
                created_at = datetime.fromisoformat(timestamp_str) if timestamp_str else datetime.now(timezone.utc)

                # Create message
                message = Message(
                    id=message_uuid,
                    conversation_id=conversation_uuid,
                    sender_id=sender_id,
                    text=text,
                    message_type=MessageType(media_type) if media_url else MessageType.TEXT,
                    media_url=media_url,
                    media_size=data.get('mediaSize'),
                    media_filename=data.get('mediaFilename'),
                    media_thumbnail=data.get('mediaThumbnail'),
                    media_width=data.get('mediaWidth'),
                    media_height=data.get('mediaHeight'),
                    media_duration=data.get('mediaDuration'),
                    has_link=bool(data.get('hasLink')),
                    reply_to_id=uuid.UUID(data['replyToId']) if data.get('replyToId') else None,
                    created_at=created_at,
                )
                db.add(message)
                await db.flush()

                # Sending implies the sender has read the conversation up to here
                await db.execute(
                    update(ConversationMember)
                    .where(
                        ConversationMember.conversation_id == conversation_uuid,
                        ConversationMember.user_id == sender_id,
                    )
                    .values(last_read_message_id=message_uuid, last_read_at=created_at)
                )

                # Keep conversation ordering in sync with its latest message
                await db.execute(
                    update(Conversation)
                    .where(Conversation.id == conversation_uuid)
                    .values(updated_at=created_at)
                )
                
                # Create delivery receipts
                members_result = await db.execute(
                    select(ConversationMember).where(
                        ConversationMember.conversation_id == conversation_uuid,
                        ConversationMember.user_id != sender_id
                    )
                )
                members = members_result.scalars().all()
                
                for member in members:
                    receipt = MessageReceipt(
                        message_id=message_uuid,
                        user_id=member.user_id,
                        status="delivered"
                    )
                    db.add(receipt)
                
                await db.commit()
                
                logger.debug("Saved message %s (%d receipts)", message_id, len(members))
                await self.streams.ack_message(msg_id)

                # Phones get a notification; a failure here never affects the saved message
                try:
                    now = datetime.now(timezone.utc)
                    await self.notify(db, message, data, [m.user_id for m in members if not (m.muted_until and m.muted_until > now)])
                except Exception:
                    logger.exception("Push notification for %s failed", message_id)
                
            except Exception:
                await db.rollback()
                raise


async def main():
    """Main entry point"""
    setup_logging()
    worker = MessageWorker()
    await worker.start()


if __name__ == "__main__":
    asyncio.run(main())