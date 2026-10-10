"""Request bodies for the devices routes (app/api/v1/devices.py)."""

from typing import Literal
from pydantic import BaseModel, Field


class DeviceRequest(BaseModel):
    token: str = Field(..., min_length=20, max_length=512)
    platform: Literal["android", "ios"]


class RemoveDeviceRequest(BaseModel):
    token: str = Field(..., min_length=20, max_length=512)
