# backend/app/services/push.py

"""
Push notifications to phones through Firebase Cloud Messaging (HTTP v1 API).

Firebase delivers to Android directly and to iPhones through Apple's push service (add your
APNs key in the Firebase console). Configure FIREBASE_SERVICE_ACCOUNT_FILE to switch it on;
without it nothing is sent. Tokens Firebase reports as gone are deleted.
"""

import json
import logging
import time
import uuid
from pathlib import Path

import httpx
import jwt
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.models.device import DeviceToken

logger = logging.getLogger(__name__)

SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
_account: dict | None = None
_access_token: tuple[str, float] | None = None  # (token, expires_at)


def _service_account() -> dict | None:
    global _account
    if _account is None and settings.FIREBASE_SERVICE_ACCOUNT_FILE:
        path = Path(settings.FIREBASE_SERVICE_ACCOUNT_FILE)
        if not path.is_absolute():
            path = Path(__file__).resolve().parents[2] / path
        try:
            _account = json.loads(path.read_text())
        except (OSError, ValueError):
            logger.error("Couldn't read FIREBASE_SERVICE_ACCOUNT_FILE (%s); push notifications are off", path)
            _account = {}
    return _account or None


def enabled() -> bool:
    return _service_account() is not None


async def _oauth_token(client: httpx.AsyncClient) -> str:
    """Short-lived Google access token, made from the service account (cached ~55 min)."""
    global _access_token
    if _access_token and _access_token[1] > time.time() + 60:
        return _access_token[0]
    account = _service_account()
    now = int(time.time())
    assertion = jwt.encode(
        {"iss": account["client_email"], "scope": SCOPE, "aud": account["token_uri"], "iat": now, "exp": now + 3600},
        account["private_key"],
        algorithm="RS256",
    )
    r = await client.post(account["token_uri"], data={
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion,
    })
    r.raise_for_status()
    body = r.json()
    _access_token = (body["access_token"], time.time() + body.get("expires_in", 3600))
    return _access_token[0]


async def send_to_users(
    db: AsyncSession, user_ids: list[uuid.UUID], title: str, body: str, data: dict[str, str],
) -> int:
    """Notify every registered phone of these users. Returns how many were accepted."""
    if not enabled() or not user_ids:
        return 0
    tokens = (await db.execute(select(DeviceToken.token).where(DeviceToken.user_id.in_(user_ids)))).scalars().all()
    if not tokens:
        return 0
    account = _service_account()
    url = f"https://fcm.googleapis.com/v1/projects/{account['project_id']}/messages:send"
    sent, gone = 0, []
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            auth = {"Authorization": f"Bearer {await _oauth_token(client)}"}
        except Exception:
            logger.exception("Couldn't get a Firebase access token")
            return 0
        for token in tokens:
            message = {
                "token": token,
                "notification": {"title": title[:100], "body": body[:240]},
                "data": data,
                "android": {"priority": "high", "notification": {"channel_id": "messages", "tag": data.get("conversationId", "")}},
                "apns": {"payload": {"aps": {"sound": "default", "thread-id": data.get("conversationId", "")}}},
            }
            try:
                r = await client.post(url, json={"message": message}, headers=auth)
            except httpx.HTTPError:
                logger.warning("Push send failed (network)")
                continue
            if r.status_code == 200:
                sent += 1
            elif r.status_code == 404 or "UNREGISTERED" in r.text:
                gone.append(token)  # app uninstalled or token replaced
            else:
                logger.warning("Push send failed: %s %s", r.status_code, r.text[:200])
    if gone:
        await db.execute(delete(DeviceToken).where(DeviceToken.token.in_(gone)))
        await db.commit()
    return sent
