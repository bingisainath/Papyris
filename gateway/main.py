import json
import asyncio
import websockets
import jwt
from redis.asyncio import Redis

redis = Redis(host="localhost", port=6379, decode_responses=True)
connected_clients = {}  # user_id → websocket instance

JWT_SECRET = "016249cd8c61975d617619beda6b80a0"


async def handler(websocket, path):
    print("🔌 New WebSocket connection")

    # ---- 1. AUTHENTICATE USER ----
    token = await websocket.recv()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload["user_id"]
        print(f"✅ Authenticated user: {user_id}")

    except Exception as e:
        print("❌ Authentication failed:", e)
        await websocket.send(json.dumps({"error": "Invalid token"}))
        return

    connected_clients[user_id] = websocket
    await websocket.send(json.dumps({"type": "CONNECTED", "user_id": user_id}))
    print(f"🟢 User {user_id} connected.")

    # Subscribe to Redis Pub/Sub
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"user:{user_id}")

    async def listen_redis():
        async for message in pubsub.listen():
            if message["type"] == "message":
                print(f"📨 Redis → {user_id}:", message["data"])
                await websocket.send(message["data"])

    asyncio.create_task(listen_redis())

    # ---- 2. RECEIVE MESSAGES ----
    try:
        async for msg in websocket:
            # print(f"📩 WebSocket received:", msg)
            data = json.loads(msg)

            if data["type"] == "SEND_MESSAGE":
                receiver = data["receiver_id"]
                payload = json.dumps({
                    "type": "NEW_MESSAGE",
                    "sender_id": user_id,
                    "message": data["message"],
                })

                print(f"➡️ Sending to Redis channel user:{receiver}: {payload}")
                await redis.publish(f"user:{receiver}", payload)

    except Exception as e:
        print("⚠️ Connection closed:", e)

    finally:
        print(f"🔴 User {user_id} disconnected.")
        del connected_clients[user_id]
        await pubsub.unsubscribe(f"user:{user_id}")


async def main():
    print("🚀 Starting WebSocket Gateway on ws://0.0.0.0:9000")
    server = await websockets.serve(handler, "0.0.0.0", 9000)
    await server.wait_closed()


if __name__ == "__main__":
    asyncio.run(main())
