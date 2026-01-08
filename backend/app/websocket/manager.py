# from __future__ import annotations
# from typing import Dict, Set
# from fastapi import WebSocket


# class ConnectionManager:
#     """
#     Rooms-based WS manager.
#     - room_id -> set(WebSocket)
#     """
#     def __init__(self) -> None:
#         self.rooms: Dict[str, Set[WebSocket]] = {}

#     async def connect(self, ws: WebSocket) -> None:
#         await ws.accept()

#     def disconnect(self, ws: WebSocket) -> None:
#         # remove socket from all rooms
#         for room_id in list(self.rooms.keys()):
#             self.rooms[room_id].discard(ws)
#             if not self.rooms[room_id]:
#                 self.rooms.pop(room_id, None)

#     def join(self, room_id: str, ws: WebSocket) -> None:
#         self.rooms.setdefault(room_id, set()).add(ws)

#     def leave(self, room_id: str, ws: WebSocket) -> None:
#         if room_id in self.rooms:
#             self.rooms[room_id].discard(ws)
#             if not self.rooms[room_id]:
#                 self.rooms.pop(room_id, None)

#     async def broadcast(self, room_id: str, payload: dict) -> None:
#         sockets = self.rooms.get(room_id, set())
#         dead: list[WebSocket] = []
#         for s in sockets:
#             try:
#                 await s.send_json(payload)
#             except Exception:
#                 dead.append(s)
#         for s in dead:
#             sockets.discard(s)



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
