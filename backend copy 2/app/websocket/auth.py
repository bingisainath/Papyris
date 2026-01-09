from fastapi import WebSocket
from jose import jwt, JWTError
from app.config.settings import settings

def get_token_from_ws(ws: WebSocket) -> str | None:
    # browser-friendly: ws://.../ws/chat?token=xxx
    token = ws.query_params.get("token")
    if token:
        return token

    # Postman can send headers
    auth = ws.headers.get("authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    return None

def verify_ws_token(token: str) -> str:
    # returns user_id (subject)
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        sub = payload.get("sub") or payload.get("subject") or payload.get("user_id")
        if not sub:
            raise JWTError("Missing subject")
        return str(sub)
    except Exception:
        raise
