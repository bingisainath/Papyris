import json
import logging
from redis.asyncio import Redis
from app.config.settings import settings

logger = logging.getLogger(__name__)

STREAM_KEY = "papyris:messages"
CONSUMER_GROUP = "papyris-workers"
# Entries that failed too many times end up here (with the reason) instead of blocking forever
DEAD_LETTER_KEY = "papyris:messages:dead"

class RedisStreams:
    def __init__(self, stream_key: str = STREAM_KEY, group: str = CONSUMER_GROUP, redis: Redis | None = None):
        self.redis = redis or Redis.from_url(settings.redis_dsn, decode_responses=True)
        self.stream_key = stream_key
        self.group = group
        self.dead_letter_key = f"{stream_key}:dead" if stream_key != STREAM_KEY else DEAD_LETTER_KEY

    async def init_stream(self):
        try:
            await self.redis.xgroup_create(self.stream_key, self.group, id='0', mkstream=True)
        except Exception as e:
            if "BUSYGROUP" not in str(e):
                logger.warning("Could not create stream consumer group: %s", e)

    async def add_message(self, payload: dict) -> str:
        redis_payload = {"data": json.dumps(payload)}
        return await self.redis.xadd(self.stream_key, redis_payload, maxlen=100000)

    async def read_messages(self, consumer_name: str, count: int = 10, block: int = 5000):
        """New entries, never handed to anyone in the group before."""
        return await self.redis.xreadgroup(self.group, consumer_name, {self.stream_key: '>'}, count=count, block=block)

    async def read_own_pending(self, consumer_name: str, count: int = 100):
        """Entries this consumer was given earlier but never acknowledged (e.g. it crashed)."""
        result = await self.redis.xreadgroup(self.group, consumer_name, {self.stream_key: '0'}, count=count)
        return [(msg_id, fields) for _, entries in (result or []) for msg_id, fields in entries if fields]

    async def claim_stale(self, consumer_name: str, min_idle_ms: int, count: int = 100):
        """
        Take over entries any consumer has held unacknowledged for at least min_idle_ms
        (a crashed worker, or a failed save waiting for a retry). Returns [(id, fields)].
        """
        claimed, start = [], "0-0"
        while True:
            next_start, entries, *_ = await self.redis.xautoclaim(
                self.stream_key, self.group, consumer_name, min_idle_ms, start_id=start, count=count,
            )
            # Entries trimmed from the stream come back without fields: nothing left to save
            claimed.extend((msg_id, fields) for msg_id, fields in entries if fields)
            if next_start in ("0-0", b"0-0") or not entries:
                return claimed
            start = next_start

    async def delivery_count(self, msg_id: str) -> int:
        """How many times this entry has been handed to a worker (1 on the first try)."""
        rows = await self.redis.xpending_range(self.stream_key, self.group, min=msg_id, max=msg_id, count=1)
        return int(rows[0]["times_delivered"]) if rows else 0

    async def dead_letter(self, msg_id: str, fields: dict, reason: str):
        """Park an entry that keeps failing, so it stops being retried, and acknowledge it."""
        await self.redis.xadd(self.dead_letter_key, {**fields, "original_id": msg_id, "reason": reason[:500]}, maxlen=10000)
        await self.ack_message(msg_id)

    async def forget_idle_consumers(self, keep: str, idle_ms: int) -> int:
        """Remove consumer names with nothing pending that haven't been seen for idle_ms."""
        removed = 0
        for consumer in await self.redis.xinfo_consumers(self.stream_key, self.group):
            if consumer["name"] != keep and consumer["pending"] == 0 and consumer["idle"] >= idle_ms:
                await self.redis.xgroup_delconsumer(self.stream_key, self.group, consumer["name"])
                removed += 1
        return removed

    async def ack_message(self, msg_id: str):
        return await self.redis.xack(self.stream_key, self.group, msg_id)

    async def close(self):
        await self.redis.close()
