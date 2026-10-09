# backend/app/schemas/user.py

import re

from pydantic import BaseModel, EmailStr, Field, field_serializer, field_validator
from uuid import UUID
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

class UserLogin(BaseModel):
    """
    ✅ NEW: Accept either username OR email in a single 'identifier' field
    This makes the frontend simpler - just one input field
    """
    identifier: str = Field(description="Username or email")
    password: str
    
    @field_validator('identifier')
    @classmethod
    def validate_identifier(cls, v: str) -> str:
        if not v or len(v.strip()) < 3:
            raise ValueError('Identifier must be at least 3 characters')
        return v.strip()

class UserResponse(BaseModel):
    id: UUID
    username: str
    email: EmailStr
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    payment_handles: Optional[dict] = None
    is_active: bool
    email_verified: bool = True
    created_at: datetime

    class Config:
        from_attributes = True

    @field_serializer("avatar")
    def sign_avatar(self, avatar: Optional[str]) -> Optional[str]:
        # Uploaded avatars are served through expiring signed links
        from app.services.media_storage import sign_url
        return sign_url(avatar)


class PaymentHandles(BaseModel):
    """Payment app usernames shown to people in your chats (empty string removes one)."""
    revolut: Optional[str] = Field(None, max_length=40, pattern=r"^$|^@?[A-Za-z0-9._-]{2,40}$")
    paypal: Optional[str] = Field(None, max_length=40, pattern=r"^$|^[A-Za-z0-9]{1,40}$")
    upi: Optional[str] = Field(None, max_length=100, pattern=r"^$|^[A-Za-z0-9._-]{2,64}@[A-Za-z0-9]{2,32}$")

    def merged_into(self, current: Optional[dict]) -> Optional[dict]:
        """Apply the fields that were sent ("" removes one) to the saved ones."""
        out = dict(current or {})
        for key, value in self.model_dump(exclude_unset=True).items():
            value = (value or "").strip().lstrip("@")
            if value:
                out[key] = value
            else:
                out.pop(key, None)
        return out or None


class UserUpdate(BaseModel):
    """Profile fields a user can change. Omitted fields are left as they are."""
    name: Optional[str] = Field(None, max_length=100)
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    bio: Optional[str] = Field(None, max_length=500)
    avatar: Optional[str] = Field(None, description="Uploaded image URL, or empty string to remove")
    payment_handles: Optional[PaymentHandles] = None

    @field_validator('name', 'username', 'bio')
    @classmethod
    def strip_text(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if isinstance(v, str) else v

    @field_validator('username')
    @classmethod
    def username_format(cls, v: Optional[str]) -> Optional[str]:
        # Same shape as at sign-up: lowercase letters, numbers, dots and underscores
        if v is None:
            return v
        v = v.lower()
        if not re.fullmatch(r"[a-z0-9._]{3,30}", v):
            raise ValueError("Use 3-30 lowercase letters, numbers, dots or underscores")
        return v