# import json
# from redis.asyncio import Redis
# from app.config.settings import settings

# STREAM_KEY = "papyris:messages"
# CONSUMER_GROUP = "papyris-workers"

# class RedisStreams:
#     def __init__(self):
#         self.redis = Redis.from_url(settings.redis_dsn, decode_responses=True)
    
#     async def init_stream(self):
#         try:
#             await self.redis.xgroup_create(STREAM_KEY, CONSUMER_GROUP, id='0', mkstream=True)
#         except Exception as e:
#             if "BUSYGROUP" not in str(e):
#                 print(f"Stream init: {e}")
    
#     async def add_message(self, payload: dict) -> str:
#         redis_payload = {"data": json.dumps(payload)}
#         return await self.redis.xadd(STREAM_KEY, redis_payload, maxlen=100000)
    
#     async def read_messages(self, consumer_name: str, count: int = 10, block: int = 5000):
#         return await self.redis.xreadgroup(CONSUMER_GROUP, consumer_name, {STREAM_KEY: '>'}, count=count, block=block)
    
#     async def ack_message(self, msg_id: str):
#         return await self.redis.xack(STREAM_KEY, CONSUMER_GROUP, msg_id)
    
#     async def close(self):
#         await self.redis.close()

# backend/app/websocket/streams.py
"""
Redis Streams with automatic in-memory fallback.
Falls back to InMemoryStreams if Redis is unreachable at startup OR mid-session.
"""

import json
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

STREAM_KEY = "papyris:messages"
CONSUMER_GROUP = "papyris-workers"


class RedisStreams:
    def __init__(self):
        self._redis = None
        self._fallback = None
        self._using_fallback = False

    # ── Internal ──────────────────────────────────────────────────────────

    async def _connect_redis(self) -> bool:
        try:
            from redis.asyncio import Redis as AIORedis
            from app.config.settings import settings

            url = getattr(settings, "REDIS_URL", None) or getattr(settings, "redis_dsn", "redis://localhost:6379/0")
            r = AIORedis.from_url(url, decode_responses=True, socket_connect_timeout=3)
            await r.ping()
            self._redis = r
            logger.info("✅ RedisStreams: connected to Redis")
            return True
        except Exception as e:
            logger.warning(f"⚠️  RedisStreams: Redis unavailable ({e}) — using in-memory fallback")
            self._redis = None
            return False

    # ── Public API ────────────────────────────────────────────────────────

    async def init_stream(self) -> None:
        from app.websocket.fallback import InMemoryStreams
        self._fallback = InMemoryStreams()

        if await self._connect_redis():
            try:
                await self._redis.xgroup_create(
                    STREAM_KEY, CONSUMER_GROUP, id="0", mkstream=True
                )
                logger.info("✅ Redis Stream and consumer group ready")
            except Exception as e:
                if "BUSYGROUP" not in str(e):
                    logger.warning(f"Stream group init note: {e}")
            self._using_fallback = False
        else:
            await self._fallback.init_stream()
            self._using_fallback = True

    async def add_message(self, payload: dict) -> str:
        if self._using_fallback or self._redis is None:
            return await self._fallback.add_message(payload)
        try:
            from app.config.settings import settings
            max_len = getattr(settings, "STREAM_MAX_LEN", 100_000)
            msg_id = await self._redis.xadd(
                STREAM_KEY, {"data": json.dumps(payload)}, maxlen=max_len
            )
            return msg_id
        except Exception as e:
            logger.warning(f"⚠️  xadd failed ({e}) — switching to fallback")
            self._using_fallback = True
            return await self._fallback.add_message(payload)

    async def read_messages(
        self, consumer_name: str, count: int = 10, block: int = 5000
    ) -> List:
        if self._using_fallback or self._redis is None:
            return await self._fallback.read_messages(consumer_name, count, block)
        try:
            return await self._redis.xreadgroup(
                CONSUMER_GROUP, consumer_name,
                {STREAM_KEY: ">"},
                count=count, block=block
            )
        except Exception as e:
            logger.warning(f"⚠️  xreadgroup failed ({e}) — switching to fallback")
            self._using_fallback = True
            return await self._fallback.read_messages(consumer_name, count, block)

    async def ack_message(self, msg_id: str) -> int:
        if self._using_fallback or self._redis is None:
            return await self._fallback.ack_message(msg_id)
        try:
            return await self._redis.xack(STREAM_KEY, CONSUMER_GROUP, msg_id)
        except Exception as e:
            logger.warning(f"⚠️  xack failed: {e}")
            return 0

    async def close(self) -> None:
        if self._redis:
            try:
                await self._redis.close()
            except Exception:
                pass
        logger.info("🛑 RedisStreams closed")