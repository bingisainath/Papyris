
from __future__ import annotations
from typing import Dict, Set
from fastapi import WebSocket

class WSManager:
    def __init__(self) -> None:
        self.user_sockets: Dict[str, Set[WebSocket]] = {}
        self.room_sockets: Dict[str, Set[WebSocket]] = {}

    async def accept(self, ws: WebSocket) -> None:
        await ws.accept()

    def track_user(self, user_id: str, ws: WebSocket) -> None:
        self.user_sockets.setdefault(user_id, set()).add(ws)

    def untrack(self, user_id: str, ws: WebSocket) -> None:
        self.user_sockets.get(user_id, set()).discard(ws)
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
        for ws in list(self.user_sockets.get(user_id, set())):
            try:
                await ws.send_json(payload)
            except Exception:
                pass
