import asyncio
import json
import uuid
from app.db.session import async_session_maker
from app.models.message import Message
from app.websocket.streams import RedisStreams

async def worker_main():
    streams = RedisStreams()
    await streams.init_stream()
    consumer_id = f"worker-{uuid.uuid4().hex[:8]}"
    print(f"🚀 Worker started: {consumer_id}")
    
    while True:
        try:
            messages = await streams.read_messages(consumer_id)
            if not messages:
                continue
            
            for stream_name, msg_list in messages:
                for msg_id, fields in msg_list:
                    try:
                        data = json.loads(fields['data'])
                        async with async_session_maker() as db:
                            msg = Message(
                                id=data['id'],
                                conversation_id=data['roomId'],
                                sender_id=data['senderId'],
                                text=data['text'],
                                status='sent'
                            )
                            db.add(msg)
                            await db.commit()
                        await streams.ack_message(msg_id)
                        print(f"✅ Saved: {data['id']}")
                    except Exception as e:
                        print(f"❌ Error: {e}")
        except Exception as e:
            print(f"Worker error: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(worker_main())