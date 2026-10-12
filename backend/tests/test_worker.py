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


async def test_worker_saves_voice_note_duration(db, make_user, make_dm):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    worker = MessageWorker.__new__(MessageWorker)
    worker.streams = FakeStreams()
    message_id = str(uuid.uuid4())
    payload = {
        "messageId": message_id, "conversationId": dm, "senderId": a.id, "text": "",
        "mediaType": "audio", "mediaUrl": "/api/v1/media/2026/10/" + "c" * 32 + ".weba",
        "mediaFilename": "voice-note.weba", "mediaDuration": 12,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await worker.process_message("1-0", {"data": json.dumps(payload)})
    saved = await db.get(Message, uuid.UUID(message_id))
    assert saved.message_type == MessageType.AUDIO and saved.media_duration == 12


# ------------------------------------------------------------------ stuck entries (real Redis)

import pytest  # noqa: E402

import app.worker as worker_module  # noqa: E402
from app.websocket.streams import RedisStreams  # noqa: E402


@pytest.fixture
async def redis_streams():
    """A throwaway stream in Redis database 15, so tests never touch the app's stream."""
    from redis.asyncio import Redis
    redis = Redis.from_url("redis://localhost:6379/15", decode_responses=True)
    try:
        await redis.ping()
    except Exception:
        pytest.skip("Redis isn't running on localhost:6379")
    key = f"test:messages:{uuid.uuid4().hex[:8]}"
    streams = RedisStreams(stream_key=key, group="test-workers", redis=redis)
    await streams.init_stream()
    yield streams
    await redis.delete(key, streams.dead_letter_key)
    await redis.close()


def _worker(streams, name):
    worker = MessageWorker.__new__(MessageWorker)
    worker.streams, worker.consumer_name, worker.running = streams, name, True
    return worker


def _entry(dm, sender, text):
    return {"messageId": str(uuid.uuid4()), "conversationId": dm, "senderId": sender.id, "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat()}


async def _pending(streams):
    return (await streams.redis.xpending(streams.stream_key, streams.group))["pending"]


async def test_a_message_left_by_a_crashed_worker_is_saved_by_another(db, make_user, make_dm, redis_streams, monkeypatch):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    payload = _entry(dm, a, "survives a crash")
    await redis_streams.add_message(payload)

    # Worker A takes the entry and dies before saving it
    taken = await redis_streams.read_messages("worker-a", block=100)
    assert taken and await _pending(redis_streams) == 1

    # Worker B's minute sweep takes it over (no wait in the test)
    monkeypatch.setattr(worker_module, "STALE_AFTER_MS", 0)
    await _worker(redis_streams, "worker-b").reclaim_stale()

    assert await db.get(Message, uuid.UUID(payload["messageId"])) is not None
    assert await _pending(redis_streams) == 0


async def test_a_restarted_worker_finishes_its_own_unacknowledged_entries(db, make_user, make_dm, redis_streams):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    payload = _entry(dm, a, "picked up after restart")
    await redis_streams.add_message(payload)
    await redis_streams.read_messages("worker-host1", block=100)  # taken, then the process stops

    await _worker(redis_streams, "worker-host1").recover()  # same name after the restart

    assert await db.get(Message, uuid.UUID(payload["messageId"])) is not None
    assert await _pending(redis_streams) == 0


async def test_an_entry_that_keeps_failing_goes_to_the_dead_letter_stream(redis_streams, monkeypatch):
    monkeypatch.setattr(worker_module, "STALE_AFTER_MS", 0)
    worker = _worker(redis_streams, "worker-a")

    async def always_fails(msg_id, fields):
        raise RuntimeError("database is down")
    worker.process_message = always_fails

    await redis_streams.add_message({"messageId": str(uuid.uuid4()), "conversationId": str(uuid.uuid4()),
                                     "senderId": str(uuid.uuid4()), "text": "poison"})
    for msg_id, fields in (await redis_streams.read_messages("worker-a", block=100))[0][1]:
        await worker.handle(msg_id, fields)  # try 1: stays pending
    assert await _pending(redis_streams) == 1

    for _ in range(worker_module.MAX_DELIVERIES - 1):  # each sweep is another try
        await worker.reclaim_stale()

    assert await _pending(redis_streams) == 0
    dead = await redis_streams.redis.xrange(redis_streams.dead_letter_key)
    assert len(dead) == 1 and "database is down" in dead[0][1]["reason"]


async def test_old_worker_names_with_nothing_pending_are_forgotten(redis_streams):
    await redis_streams.add_message({"text": "x"})
    entries = await redis_streams.read_messages("worker-old", block=100)
    await redis_streams.ack_message(entries[0][1][0][0])
    assert await redis_streams.forget_idle_consumers(keep="worker-new", idle_ms=0) == 1
    names = [c["name"] for c in await redis_streams.redis.xinfo_consumers(redis_streams.stream_key, redis_streams.group)]
    assert "worker-old" not in names
