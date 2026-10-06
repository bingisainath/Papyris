# backend/app/api/v1/devices.py

"""Phones register their push token after sign-in and remove it on logout."""

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.device import DeviceToken
from app.models.user import User

router = APIRouter(prefix="/devices", tags=["Devices"])


class DeviceRequest(BaseModel):
    token: str = Field(..., min_length=20, max_length=512)
    platform: Literal["android", "ios"]


class RemoveDeviceRequest(BaseModel):
    token: str = Field(..., min_length=20, max_length=512)


@router.post("")
async def register_device(body: DeviceRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Save (or move to this account) a phone's push token."""
    existing = (await db.execute(select(DeviceToken).where(DeviceToken.token == body.token))).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if existing:
        # Same phone, possibly a different account now: notifications follow whoever is signed in
        existing.user_id, existing.platform, existing.last_seen_at = current_user.id, body.platform, now
    else:
        db.add(DeviceToken(user_id=current_user.id, token=body.token, platform=body.platform, last_seen_at=now))
    await db.commit()
    return {"success": True, "message": "Device registered", "data": None}


@router.post("/remove")
async def remove_device(body: RemoveDeviceRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Stop notifications to this phone (on logout)."""
    await db.execute(delete(DeviceToken).where(DeviceToken.token == body.token, DeviceToken.user_id == current_user.id))
    await db.commit()
    return {"success": True, "message": "Device removed", "data": None}
