# backend/app/websocket/fallback.py
"""
In-memory fallbacks for Redis PubSub and Redis Streams.
Automatically used when Redis is unavailable.
Works for single-instance deployments only.
"""

import json
import asyncio
import logging
from collections import deque
from typing import Callable, Dict, List, Optional, Any, Set

logger = logging.getLogger(__name__)


class InMemoryPubSub:
    """
    Drop-in replacement for Redis PubSub.
    Uses asyncio.Queue to pass events locally within the same process.
    """

    def __init__(self):
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=10_000)
        self._task: Optional[asyncio.Task] = None
        self._running = False

    async def publish(self, payload: dict) -> None:
        try:
            self._queue.put_nowait(payload)
        except asyncio.QueueFull:
            logger.warning("⚠️  InMemoryPubSub queue full — dropping message")

    async def run(self, on_event: Callable) -> None:
        self._running = True
        logger.info("🟢 InMemoryPubSub listener started")
        while self._running:
            try:
                data = await asyncio.wait_for(self._queue.get(), timeout=0.5)
                try:
                    await on_event(data)
                except Exception as e:
                    logger.error(f"❌ InMemoryPubSub on_event error: {e}")
                finally:
                    self._queue.task_done()
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"❌ InMemoryPubSub run error: {e}")
                await asyncio.sleep(0.1)

    def start(self, on_event: Callable) -> None:
        self._task = asyncio.create_task(self.run(on_event))
        logger.info("✅ InMemoryPubSub started (Redis unavailable)")

    async def stop(self) -> None:
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("🛑 InMemoryPubSub stopped")


class InMemoryStreams:
    """
    Drop-in replacement for Redis Streams.
    Stores messages in an in-memory deque — data is lost on restart.
    """

    def __init__(self, maxlen: int = 100_000):
        self._stream: deque = deque(maxlen=maxlen)
        self._counter: int = 0
        self._acked: Dict[str, Set[str]] = {}  # consumer -> set of acked msg_ids

    async def init_stream(self) -> None:
        logger.info("✅ InMemoryStreams initialized (Redis unavailable)")

    async def add_message(self, payload: dict) -> str:
        self._counter += 1
        msg_id = f"inmem-{self._counter}-0"
        self._stream.append((msg_id, {"data": json.dumps(payload)}))
        return msg_id

    async def read_messages(
        self, consumer_name: str, count: int = 10, block: int = 5000
    ) -> List:
        """Return up to `count` messages not yet acked by this consumer."""
        if consumer_name not in self._acked:
            self._acked[consumer_name] = set()

        acked = self._acked[consumer_name]
        results = [
            (msg_id, data)
            for msg_id, data in list(self._stream)[-count * 2:]
            if msg_id not in acked
        ][:count]

        if not results:
            await asyncio.sleep(min(block / 1000, 1.0))

        return [("inmem-stream", results)] if results else []

    async def ack_message(self, msg_id: str, consumer_name: str = "__default__") -> int:
        if consumer_name not in self._acked:
            self._acked[consumer_name] = set()
        self._acked[consumer_name].add(msg_id)
        return 1

    async def close(self) -> None:
        logger.info("🛑 InMemoryStreams closed")