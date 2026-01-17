# from fastapi import HTTPException, status
# from sqlalchemy.ext.asyncio import AsyncSession
# from sqlalchemy import select

# from app.models.user import User
# from app.schemas.user import UserCreate
# from app.schemas.auth import Token
# from app.core.security import hash_password, verify_password, create_access_token


# class AuthService:
#     # -----------------------------
#     # Queries
#     # -----------------------------
#     @staticmethod
#     async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
#         result = await db.execute(select(User).where(User.email == email))
#         return result.scalar_one_or_none()

#     @staticmethod
#     async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
#         result = await db.execute(select(User).where(User.username == username))
#         return result.scalar_one_or_none()

#     # -----------------------------
#     # Registration
#     # -----------------------------
#     @staticmethod
#     async def create_user(db: AsyncSession, user_in: UserCreate) -> User:
#         if await AuthService.get_user_by_email(db, user_in.email):
#             raise HTTPException(
#                 status_code=status.HTTP_409_CONFLICT,
#                 detail="Email already registered",
#             )

#         if await AuthService.get_user_by_username(db, user_in.username):
#             raise HTTPException(
#                 status_code=status.HTTP_409_CONFLICT,
#                 detail="Username already taken",
#             )

#         user = User(
#             username=user_in.username,
#             email=user_in.email,
#             hashed_password=hash_password(user_in.password),
#             is_active=True,
#         )

#         db.add(user)
#         await db.commit()
#         await db.refresh(user)
#         return user

#     @staticmethod
#     async def register_user(db: AsyncSession, user_in: UserCreate) -> User:
#         return await AuthService.create_user(db, user_in)

#     # -----------------------------
#     # Authentication
#     # -----------------------------
#     @staticmethod
#     async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
#         user = await AuthService.get_user_by_email(db, email)

#         # ✅ As you requested: explicit email-not-found message
#         if not user:
#             raise HTTPException(
#                 status_code=status.HTTP_404_NOT_FOUND,
#                 detail="Email does not exist",
#             )

#         if not verify_password(password, user.hashed_password):
#             raise HTTPException(
#                 status_code=status.HTTP_401_UNAUTHORIZED,
#                 detail="Invalid credentials",
#             )

#         if not user.is_active:
#             raise HTTPException(
#                 status_code=status.HTTP_403_FORBIDDEN,
#                 detail="User account is inactive",
#             )

#         return user

#     @staticmethod
#     async def login_user(db: AsyncSession, email: str, password: str) -> Token:
#         user = await AuthService.authenticate_user(db, email, password)

#         access_token = create_access_token(subject=str(user.id))
#         # ✅ return Token (not dict)
#         return Token(access_token=access_token, token_type="bearer")


# backend/app/services/auth_service.py - UPDATED

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from datetime import datetime, timedelta, timezone
import secrets
import re

from app.models.user import User
from app.schemas.user import UserCreate
from app.schemas.auth import Token
from app.core.security import hash_password, verify_password, create_access_token


class AuthService:
    # -----------------------------
    # Helper: Email Detection
    # -----------------------------
    @staticmethod
    def is_email(identifier: str) -> bool:
        """Check if identifier is an email address"""
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(email_pattern, identifier))

    # -----------------------------
    # Queries
    # -----------------------------
    @staticmethod
    async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
        result = await db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_user_by_identifier(db: AsyncSession, identifier: str) -> User | None:
        """
        ✅ NEW: Get user by either username OR email
        This enables single-field login
        """
        if AuthService.is_email(identifier):
            return await AuthService.get_user_by_email(db, identifier)
        else:
            return await AuthService.get_user_by_username(db, identifier)
    
    @staticmethod
    async def get_user_by_reset_token(db: AsyncSession, token: str) -> User | None:
        """Get user by password reset token"""
        result = await db.execute(select(User).where(User.reset_token == token))
        return result.scalar_one_or_none()

    # -----------------------------
    # Registration
    # -----------------------------
    @staticmethod
    async def create_user(db: AsyncSession, user_in: UserCreate) -> User:
        if await AuthService.get_user_by_email(db, user_in.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        if await AuthService.get_user_by_username(db, user_in.username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken",
            )

        user = User(
            username=user_in.username,
            email=user_in.email,
            hashed_password=hash_password(user_in.password),
            is_active=True,
        )

        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def register_user(db: AsyncSession, user_in: UserCreate) -> User:
        return await AuthService.create_user(db, user_in)

    # -----------------------------
    # Authentication (Username OR Email)
    # -----------------------------
    @staticmethod
    async def authenticate_user(db: AsyncSession, identifier: str, password: str) -> User:
        """
        ✅ UPDATED: Authenticate with username OR email
        """
        user = await AuthService.get_user_by_identifier(db, identifier)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Username or email does not exist",
            )

        if not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive",
            )

        return user

    @staticmethod
    async def login_user(db: AsyncSession, identifier: str, password: str) -> Token:
        """
        ✅ UPDATED: Login with username OR email
        """
        user = await AuthService.authenticate_user(db, identifier, password)

        # Update last login
        user.last_login = datetime.now(timezone.utc)
        await db.commit()

        access_token = create_access_token(subject=str(user.id))
        return Token(access_token=access_token, token_type="bearer")

    # -----------------------------
    # ✅ NEW: Password Reset
    # -----------------------------
    @staticmethod
    async def request_password_reset(db: AsyncSession, identifier: str) -> tuple[bool, User | None]:
        """
        Request password reset (returns user if found, None otherwise)
        
        Returns:
            (success, user): Tuple of success flag and user object
        """
        user = await AuthService.get_user_by_identifier(db, identifier)
        
        if not user:
            # Don't reveal if user exists (security)
            return (False, None)
        
        # Generate secure token
        reset_token = secrets.token_urlsafe(32)
        
        # Set expiration (1 hour)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        
        # Update user
        user.reset_token = reset_token
        user.reset_token_expires = expires_at
        await db.commit()
        
        return (True, user)
    
    @staticmethod
    async def verify_reset_token(db: AsyncSession, token: str) -> User:
        """
        Verify reset token is valid and not expired
        
        Raises:
            HTTPException if token is invalid or expired
        """
        user = await AuthService.get_user_by_reset_token(db, token)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
        
        # Check if expired
        now = datetime.now(timezone.utc)
        if user.reset_token_expires < now:
            # Clear expired token
            user.reset_token = None
            user.reset_token_expires = None
            await db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reset token has expired. Please request a new one."
            )
        
        return user
    
    @staticmethod
    async def reset_password(db: AsyncSession, token: str, new_password: str) -> User:
        """
        Reset password using valid token
        
        Token is single-use and will be cleared after successful reset
        """
        # Verify token
        user = await AuthService.verify_reset_token(db, token)
        
        # Hash new password
        user.hashed_password = hash_password(new_password)
        
        # Clear reset token (single-use)
        user.reset_token = None
        user.reset_token_expires = None
        
        await db.commit()
        await db.refresh(user)
        
        return user