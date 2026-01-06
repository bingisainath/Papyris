import json
from redis.asyncio import Redis
from app.config.settings import settings

STREAM_KEY = "papyris:messages"
CONSUMER_GROUP = "papyris-workers"

class RedisStreams:
    def __init__(self):
        self.redis = Redis.from_url(settings.redis_dsn, decode_responses=True)
    
    async def init_stream(self):
        try:
            await self.redis.xgroup_create(STREAM_KEY, CONSUMER_GROUP, id='0', mkstream=True)
        except Exception as e:
            if "BUSYGROUP" not in str(e):
                print(f"Stream init: {e}")
    
    async def add_message(self, payload: dict) -> str:
        redis_payload = {"data": json.dumps(payload)}
        return await self.redis.xadd(STREAM_KEY, redis_payload, maxlen=100000)
    
    async def read_messages(self, consumer_name: str, count: int = 10, block: int = 5000):
        return await self.redis.xreadgroup(CONSUMER_GROUP, consumer_name, {STREAM_KEY: '>'}, count=count, block=block)
    
    async def ack_message(self, msg_id: str):
        return await self.redis.xack(STREAM_KEY, CONSUMER_GROUP, msg_id)
    
    async def close(self):
        await self.redis.close()