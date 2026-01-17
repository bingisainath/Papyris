# from pydantic import BaseModel
# from typing import Optional

# class Token(BaseModel):
#     access_token: str
#     token_type: str = "bearer"

# class TokenData(BaseModel):
#     user_id: Optional[str] = None


# backend/app/schemas/auth.py - UPDATED

from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: Optional[str] = None

# ✅ NEW: Password Reset Schemas
class ForgotPasswordRequest(BaseModel):
    """Request to send password reset email"""
    identifier: str = Field(description="Username or email")

class VerifyResetTokenRequest(BaseModel):
    """Verify if reset token is valid"""
    token: str

class ResetPasswordRequest(BaseModel):
    """Reset password with valid token"""
    token: str
    new_password: str = Field(min_length=6, max_length=128)
    
    class Config:
        json_schema_extra = {
            "example": {
                "token": "abc123xyz789...",
                "new_password": "NewSecurePassword123"
            }
        }