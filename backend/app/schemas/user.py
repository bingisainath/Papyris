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
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True