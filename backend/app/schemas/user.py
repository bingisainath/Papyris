# from pydantic import BaseModel, EmailStr, Field
# from uuid import UUID
# from datetime import datetime

# class UserCreate(BaseModel):
#     username: str = Field(min_length=3, max_length=50)
#     email: EmailStr
#     password: str = Field(min_length=6, max_length=128)

# class UserLogin(BaseModel):
#     email: EmailStr
#     password: str

# class UserResponse(BaseModel):
#     id: UUID
#     username: str
#     email: EmailStr
#     is_active: bool
#     created_at: datetime

#     class Config:
#         from_attributes = True


# backend/app/schemas/user.py - UPDATED

from pydantic import BaseModel, EmailStr, Field, field_validator
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
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """Profile fields a user can change. Omitted fields are left as they are."""
    name: Optional[str] = Field(None, max_length=100)
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    bio: Optional[str] = Field(None, max_length=500)
    avatar: Optional[str] = Field(None, description="Uploaded image URL, or empty string to remove")

    @field_validator('name', 'username', 'bio')
    @classmethod
    def strip_text(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if isinstance(v, str) else v