"""Request bodies for the e2e backup routes (app/api/v1/e2e_backup.py)."""

from typing import Any
from pydantic import BaseModel, Field
from app.services import media_storage


class BackupBody(BaseModel):
    url: str = Field(..., max_length=500)
    sha256: str = Field(..., max_length=64)
    size: int = Field(..., ge=0, le=media_storage.MAX_BACKUP_SIZE)
    wrapped_key: dict[str, Any]
    verifier: str = Field(..., max_length=64)
