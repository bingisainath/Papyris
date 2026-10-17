from __future__ import annotations
from typing import Dict, Set
from fastapi import WebSocket

# Protocol 3: encrypted (v2) messages arrive only as per-device envelopes that carry the message's
# details, and the sender gets `message_sent`. Older apps (no `proto`) also get the marker `message`.
ENVELOPE_FIRST_PROTO = 3
# Events only for older apps: dropped for sockets on protocol 3 or later
LEGACY_KEY = "_legacy"


class WSManager:
    def __init__(self) -> None:
        self.user_sockets: Dict[str, Set[WebSocket]] = {}
        self.room_sockets: Dict[str, Set[WebSocket]] = {}
        self.protocols: Dict[WebSocket, int] = {}

    async def accept(self, ws: WebSocket) -> None:
        await ws.accept()

    def track_user(self, user_id: str, ws: WebSocket, proto: int = 0) -> None:
        self.user_sockets.setdefault(user_id, set()).add(ws)
        self.protocols[ws] = proto

    def proto(self, ws: WebSocket) -> int:
        return self.protocols.get(ws, 0)

    def untrack(self, user_id: str, ws: WebSocket) -> None:
        self.user_sockets.get(user_id, set()).discard(ws)
        self.protocols.pop(ws, None)
        for room in list(self.room_sockets.keys()):
            self.room_sockets[room].discard(ws)
            if not self.room_sockets[room]:
                self.room_sockets.pop(room, None)

    def join_room(self, room_id: str, ws: WebSocket) -> None:
        self.room_sockets.setdefault(room_id, set()).add(ws)

    async def broadcast_room(self, room_id: str, payload: dict) -> None:
        for ws in list(self.room_sockets.get(room_id, set())):
            try:
                await ws.send_json(payload)
            except Exception:
                pass

    async def send_user(self, user_id: str, payload: dict) -> None:
        legacy = payload.get(LEGACY_KEY)
        if legacy is not None:
            payload = {k: v for k, v in payload.items() if k != LEGACY_KEY}
        for ws in list(self.user_sockets.get(user_id, set())):
            if legacy and self.proto(ws) >= ENVELOPE_FIRST_PROTO:
                continue
            try:
                await ws.send_json(payload)
            except Exception:
                pass
