# backend/app/services/secrets.py

"""
Encrypts the AI keys people add themselves. Keys are stored encrypted, used only on
the server, and never sent back to anyone (the app only ever sees '…abcd').
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config.settings import settings


def _fernet() -> Fernet:
    secret = settings.AI_KEY_ENCRYPTION_SECRET or f"ai-keys:{settings.JWT_SECRET_KEY}"
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest()))


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: str | None) -> str | None:
    """None if missing or if the secret changed since it was saved."""
    if not token:
        return None
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return None


def mask(value: str | None) -> str | None:
    return f"…{value[-4:]}" if value else None
