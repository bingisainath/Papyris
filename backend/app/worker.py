
# # backend/app/worker.py

# """
# Background worker that consumes messages from Redis Streams
# and persists them to PostgreSQL database.

# This allows the WebSocket gateway to remain fast and responsive
# while message persistence happens asynchronously.

# Run this worker with: python -m app.worker
# """

# import asyncio
# import json
# import uuid
# from datetime import datetime
# from sqlalchemy.ext.asyncio import AsyncSession

# from app.db.session import async_session_maker
# from app.websocket.streams import RedisStreams
# from app.models.message import Message
# from app.models.message_receipt import MessageReceipt
# from app.models.conversation_member import ConversationMember
# from sqlalchemy import select


# class MessageWorker:
#     def __init__(self):
#         self.streams = RedisStreams()
#         self.consumer_name = f"worker-{uuid.uuid4().hex[:8]}"
#         self.running = False

#     async def start(self):
#         """Start the worker"""
#         print(f"🚀 Starting message worker: {self.consumer_name}")
        
#         # Initialize stream and consumer group
#         await self.streams.init_stream()
        
#         self.running = True
        
#         try:
#             await self.consume_loop()
#         except KeyboardInterrupt:
#             print("\n⚠️ Received interrupt signal")
#         finally:
#             await self.stop()

#     async def stop(self):
#         """Stop the worker"""
#         print("🛑 Stopping message worker...")
#         self.running = False
#         await self.streams.close()

#     async def consume_loop(self):
#         """Main consumption loop"""
#         print("👂 Listening for messages...")
        
#         while self.running:
#             try:
#                 # Read messages from stream (blocks for 5 seconds)
#                 results = await self.streams.read_messages(
#                     consumer_name=self.consumer_name,
#                     count=10,
#                     block=5000
#                 )
                
#                 if not results:
#                     continue
                
#                 # Process each message
#                 for stream_name, messages in results:
#                     for msg_id, fields in messages:
#                         try:
#                             await self.process_message(msg_id, fields)
#                         except Exception as e:
#                             print(f"❌ Error processing message {msg_id}: {e}")
#                             import traceback
#                             traceback.print_exc()
#                             # Don't ack failed messages so they can be retried
                        
#             except Exception as e:
#                 print(f"❌ Error in consume loop: {e}")
#                 await asyncio.sleep(1)  # Prevent tight loop on errors

#     async def process_message(self, msg_id: str, fields: dict):
#         """Process a single message from the stream"""
#         # Parse the message data
#         # data_json = fields.get(b'data', b'{}').decode()
#         data_json = fields.get('data', '{}') 
#         data = json.loads(data_json)
        
#         message_id = data.get('messageId')
#         conversation_id = data.get('conversationId')
#         sender_id_str = data.get('senderId')
#         text = data.get('text')
#         timestamp_str = data.get('timestamp')
        
#         if not all([message_id, conversation_id, sender_id_str, text]):
#             print(f"⚠️ Invalid message data: {data}")
#             await self.streams.ack_message(msg_id)
#             return
        
#         print(f"📨 Processing message {message_id} from {sender_id_str}")
        
#         async with async_session_maker() as db:
#             try:
#                 # Convert sender_id to UUID
#                 sender_id = uuid.UUID(sender_id_str)

#                 # ✅ Convert message_id and conversation_id to UUID
#                 message_uuid = uuid.UUID(message_id)
#                 conversation_uuid = uuid.UUID(conversation_id)
                
#                 # Check if message already exists (idempotency)
#                 result = await db.execute(
#                     select(Message).where(Message.id == message_id)
#                 )
#                 if result.scalar_one_or_none():
#                     print(f"ℹ️ Message {message_id} already exists, skipping")
#                     await self.streams.ack_message(msg_id)
#                     return
                
#                 # Create message
#                 message = Message(
#                     id=message_uuid,
#                     conversation_id=conversation_uuid,
#                     sender_id=sender_id,
#                     text=text,
#                     # status="sent"
#                 )
#                 db.add(message)
#                 await db.flush()  # Flush to get the message in DB
                
#                 # Create delivery receipts for all conversation members (except sender)
#                 members_result = await db.execute(
#                     select(ConversationMember).where(
#                         ConversationMember.conversation_id == conversation_uuid,
#                         ConversationMember.user_id != sender_id
#                     )
#                 )
#                 members = members_result.scalars().all()
                
#                 for member in members:
#                     receipt = MessageReceipt(
#                         message_id=message_uuid,
#                         user_id=member.user_id,
#                         status="delivered"
#                     )
#                     db.add(receipt)
                
#                 # Commit everything
#                 await db.commit()
                
#                 print(f"✅ Message {message_id} persisted with {len(members)} receipts")
                
#                 # Acknowledge the message from stream
#                 await self.streams.ack_message(msg_id)
                
#             except Exception as e:
#                 await db.rollback()
#                 print(f"❌ Failed to persist message {message_id}: {e}")
#                 raise  # Don't ack so it can be retried


# async def main():
#     """Main entry point"""
#     worker = MessageWorker()
#     await worker.start()


# if __name__ == "__main__":
#     asyncio.run(main())


# backend/app/worker.py - COMPLETE FIXED VERSION

import asyncio
import json
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_maker
from app.websocket.streams import RedisStreams
from app.models.message import Message
from app.models.message_receipt import MessageReceipt
from app.models.conversation_member import ConversationMember
from sqlalchemy import select


class MessageWorker:
    def __init__(self):
        self.streams = RedisStreams()
        self.consumer_name = f"worker-{uuid.uuid4().hex[:8]}"
        self.running = False

    async def start(self):
        """Start the worker"""
        print(f"🚀 Starting message worker: {self.consumer_name}")
        await self.streams.init_stream()
        self.running = True
        
        try:
            await self.consume_loop()
        except KeyboardInterrupt:
            print("\n⚠️ Received interrupt signal")
        finally:
            await self.stop()

    async def stop(self):
        """Stop the worker"""
        print("🛑 Stopping message worker...")
        self.running = False
        await self.streams.close()

    async def consume_loop(self):
        """Main consumption loop"""
        print("👂 Listening for messages...")
        
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
                        except Exception as e:
                            print(f"❌ Error processing message {msg_id}: {e}")
                            import traceback
                            traceback.print_exc()
                        
            except Exception as e:
                print(f"❌ Error in consume loop: {e}")
                await asyncio.sleep(1)

    async def process_message(self, msg_id: str, fields: dict):
        """Process a single message from the stream"""
        # ✅ FIX: fields is already decoded, no .decode() needed
        data_json = fields.get('data', '{}')
        data = json.loads(data_json)
        
        message_id = data.get('messageId')
        conversation_id = data.get('conversationId')
        sender_id_str = data.get('senderId')
        text = data.get('text')
        
        if not all([message_id, conversation_id, sender_id_str, text]):
            print(f"⚠️ Invalid message data: {data}")
            await self.streams.ack_message(msg_id)
            return
        
        print(f"📨 Processing message {message_id} from {sender_id_str}")
        
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
                    print(f"ℹ️ Message {message_id} already exists, skipping")
                    await self.streams.ack_message(msg_id)
                    return
                
                # Create message
                message = Message(
                    id=message_uuid,
                    conversation_id=conversation_uuid,
                    sender_id=sender_id,
                    text=text
                )
                db.add(message)
                await db.flush()
                
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
                
                print(f"✅ Message {message_id} persisted with {len(members)} receipts")
                await self.streams.ack_message(msg_id)
                
            except Exception as e:
                await db.rollback()
                print(f"❌ Failed to persist message {message_id}: {e}")
                import traceback
                traceback.print_exc()
                raise


async def main():
    """Main entry point"""
    worker = MessageWorker()
    await worker.start()


if __name__ == "__main__":
    asyncio.run(main())