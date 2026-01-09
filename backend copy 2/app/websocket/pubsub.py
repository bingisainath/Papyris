import json
import asyncio
from redis.asyncio import Redis
from app.config.settings import settings

CHANNEL = "papyris:ws:events"

class PubSub:
    def __init__(self) -> None:
        self.redis = Redis.from_url(settings.redis_dsn, decode_responses=True)
        self._task: asyncio.Task | None = None

    async def publish(self, payload: dict) -> None:
        await self.redis.publish(CHANNEL, json.dumps(payload))

    async def run(self, on_event):
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(CHANNEL)
        async for msg in pubsub.listen():
            if msg["type"] != "message":
                continue
            data = json.loads(msg["data"])
            await on_event(data)

    def start(self, on_event):
        self._task = asyncio.create_task(self.run(on_event))

    async def stop(self):
        if self._task:
            self._task.cancel()
