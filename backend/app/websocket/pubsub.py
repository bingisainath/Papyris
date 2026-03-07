# import json
# import asyncio
# from redis.asyncio import Redis
# from app.config.settings import settings

# CHANNEL = "papyris:ws:events"

# class PubSub:
#     def __init__(self) -> None:
#         self.redis = Redis.from_url(settings.redis_dsn, decode_responses=True)
#         self._task: asyncio.Task | None = None

#     async def publish(self, payload: dict) -> None:
#         await self.redis.publish(CHANNEL, json.dumps(payload))

#     async def run(self, on_event):
#         pubsub = self.redis.pubsub()
#         await pubsub.subscribe(CHANNEL)
#         async for msg in pubsub.listen():
#             if msg["type"] != "message":
#                 continue
#             data = json.loads(msg["data"])
#             await on_event(data)

#     def start(self, on_event):
#         self._task = asyncio.create_task(self.run(on_event))

#     async def stop(self):
#         if self._task:
#             self._task.cancel()


# backend/app/websocket/pubsub.py
"""
Redis PubSub with automatic in-memory fallback.
Falls back to InMemoryPubSub if Redis is unreachable at startup OR crashes mid-session.
"""

import json
import asyncio
import logging
from typing import Callable, Optional

logger = logging.getLogger(__name__)

CHANNEL = "papyris:ws:events"


class PubSub:
    def __init__(self) -> None:
        self.redis = None           # Set when Redis is available
        self._fallback = None       # InMemoryPubSub instance
        self._using_fallback = False
        self._task: Optional[asyncio.Task] = None

    # ── Internal ──────────────────────────────────────────────────────────

    async def _connect_redis(self) -> bool:
        """Try to connect to Redis. Returns True on success."""
        try:
            from redis.asyncio import Redis as AIORedis
            from app.config.settings import settings

            url = getattr(settings, "REDIS_URL", None) or getattr(settings, "redis_dsn", "redis://localhost:6379/0")
            r = AIORedis.from_url(url, decode_responses=True, socket_connect_timeout=3)
            await r.ping()
            self.redis = r
            logger.info("✅ PubSub: connected to Redis")
            return True
        except Exception as e:
            logger.warning(f"⚠️  PubSub: Redis unavailable ({e}) — using in-memory fallback")
            self.redis = None
            return False

    async def _redis_listener(self, on_event: Callable) -> None:
        """Listen to Redis channel. Falls back if connection drops."""
        try:
            ps = self.redis.pubsub()
            await ps.subscribe(CHANNEL)
            async for msg in ps.listen():
                if msg["type"] != "message":
                    continue
                try:
                    data = json.loads(msg["data"])
                    await on_event(data)
                except Exception as e:
                    logger.error(f"❌ PubSub on_event error: {e}")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"❌ Redis PubSub listener crashed: {e}. Switching to in-memory fallback.")
            self._using_fallback = True
            if self._fallback:
                await self._fallback.run(on_event)

    async def _start_async(self, on_event: Callable) -> None:
        from app.websocket.fallback import InMemoryPubSub
        self._fallback = InMemoryPubSub()

        if await self._connect_redis():
            self._using_fallback = False
            await self._redis_listener(on_event)
        else:
            self._using_fallback = True
            await self._fallback.run(on_event)

    # ── Public API ────────────────────────────────────────────────────────

    async def publish(self, payload: dict) -> None:
        if self._using_fallback or self.redis is None:
            if self._fallback:
                await self._fallback.publish(payload)
            return
        try:
            await self.redis.publish(CHANNEL, json.dumps(payload))
        except Exception as e:
            logger.warning(f"⚠️  PubSub publish failed ({e}) — switching to fallback")
            self._using_fallback = True
            if self._fallback:
                await self._fallback.publish(payload)

    def start(self, on_event: Callable) -> None:
        self._task = asyncio.create_task(self._start_async(on_event))

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._fallback:
            await self._fallback.stop()
        if self.redis:
            try:
                await self.redis.close()
            except Exception:
                pass
        logger.info("🛑 PubSub stopped")