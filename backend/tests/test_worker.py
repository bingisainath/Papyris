import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.models.conversation_member import ConversationMember
from app.models.message import Message, MessageType
from app.worker import MessageWorker


class FakeStreams:
    def __init__(self):
        self.acked = []

    async def ack_message(self, msg_id):
        self.acked.append(msg_id)


async def test_worker_persists_media_reply_and_read_pointer(db, make_user, make_dm, add_message):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    original = await add_message(dm, b, "question")

    worker = MessageWorker.__new__(MessageWorker)  # skip Redis setup
    worker.streams = FakeStreams()
    message_id = str(uuid.uuid4())
    payload = {
        "messageId": message_id, "conversationId": dm, "senderId": a.id, "text": "",
        "mediaType": "image", "mediaUrl": "/api/v1/media/2026/10/" + "b" * 32 + ".png",
        "mediaFilename": "pic.png", "mediaWidth": 640, "mediaHeight": 480,
        "replyToId": original, "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await worker.process_message("1-0", {"data": json.dumps(payload)})

    assert worker.streams.acked == ["1-0"]
    saved = await db.get(Message, uuid.UUID(message_id))
    assert saved.message_type == MessageType.IMAGE
    assert (saved.media_width, saved.media_height) == (640, 480)
    assert str(saved.reply_to_id) == original
    # sending means you've read the chat up to your own message
    member = (await db.execute(select(ConversationMember).where(
        ConversationMember.conversation_id == uuid.UUID(dm),
        ConversationMember.user_id == uuid.UUID(a.id),
    ))).scalar_one()
    assert str(member.last_read_message_id) == message_id


async def test_worker_skips_duplicates(db, make_user, make_dm):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    worker = MessageWorker.__new__(MessageWorker)
    worker.streams = FakeStreams()
    payload = {"messageId": str(uuid.uuid4()), "conversationId": dm, "senderId": a.id, "text": "once",
               "timestamp": datetime.now(timezone.utc).isoformat()}
    for i in range(2):
        await worker.process_message(f"{i}-0", {"data": json.dumps(payload)})
    rows = (await db.execute(select(Message).where(Message.conversation_id == uuid.UUID(dm)))).scalars().all()
    assert len(rows) == 1 and worker.streams.acked == ["0-0", "1-0"]
