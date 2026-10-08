# backend/app/api/v1/e2e_backup.py

"""
Optional end-to-end encrypted backup (docs/encryption-design-v2.md): one per account.

The apps encrypt the backup on the device (PMV2 format, random key), upload it like any encrypted
file, and store here the blob's address plus its key wrapped with a key derived from the person's
64-digit recovery key. The recovery key never reaches the server.

  GET    /e2e/backup     whether there is one (and what's needed to restore it)
  PUT    /e2e/backup     replace it with a newer one
  DELETE /e2e/backup     turn backups off
"""

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.e2e_v2 import E2EBackup
from app.models.user import User
from app.services import media_storage

router = APIRouter(prefix="/e2e/backup", tags=["Encrypted backup"])


class BackupBody(BaseModel):
    url: str = Field(..., max_length=500)
    sha256: str = Field(..., max_length=64)
    size: int = Field(..., ge=0, le=media_storage.MAX_BACKUP_SIZE)
    wrapped_key: dict[str, Any]
    verifier: str = Field(..., max_length=64)


def _view(b: E2EBackup) -> dict:
    return {
        "exists": True, "url": media_storage.sign_url(b.url), "sha256": b.sha256, "size": b.size,
        "wrapped_key": json.loads(b.wrapped_key), "verifier": b.verifier, "created_at": b.created_at.isoformat(),
    }


def _remove_file(url: str) -> None:
    key = media_storage.key_from_url(url)
    path = media_storage.path_for_key(key) if key else None
    if path is not None:
        path.unlink(missing_ok=True)


@router.get("")
async def get_backup(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    backup = await db.get(E2EBackup, user.id)
    return {"success": True, "data": _view(backup) if backup else {"exists": False}}


@router.put("")
async def save_backup(body: BackupBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    url = media_storage.unsigned(body.url)
    if not media_storage.is_stored_media_url(url) or not url.endswith(media_storage.ENCRYPTED_EXTENSION):
        raise HTTPException(status_code=422, detail="Upload the encrypted backup first")
    if not {"n", "c"} <= body.wrapped_key.keys() or len(json.dumps(body.wrapped_key)) > 512:
        raise HTTPException(status_code=422, detail="Invalid wrapped key")
    backup = await db.get(E2EBackup, user.id)
    old_url = backup.url if backup else None
    if backup is None:
        backup = E2EBackup(user_id=user.id)
        db.add(backup)
    backup.url, backup.sha256, backup.size = url, body.sha256, body.size
    backup.wrapped_key, backup.verifier = json.dumps(body.wrapped_key), body.verifier
    backup.created_at = datetime.now(timezone.utc)
    await db.commit()
    if old_url and old_url != url:
        _remove_file(old_url)  # only the newest backup is kept
    return {"success": True, "data": _view(backup)}


@router.delete("")
async def delete_backup(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    backup = await db.get(E2EBackup, user.id)
    if backup is not None:
        _remove_file(backup.url)
        await db.delete(backup)
        await db.commit()
    return {"success": True}
