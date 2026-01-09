from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.schemas.user import UserCreate
from app.schemas.auth import Token
from app.core.security import hash_password, verify_password, create_access_token


class AuthService:
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
    # Authentication
    # -----------------------------
    @staticmethod
    async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
        user = await AuthService.get_user_by_email(db, email)

        # ✅ As you requested: explicit email-not-found message
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email does not exist",
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
    async def login_user(db: AsyncSession, email: str, password: str) -> Token:
        user = await AuthService.authenticate_user(db, email, password)

        access_token = create_access_token(subject=str(user.id))
        # ✅ return Token (not dict)
        return Token(access_token=access_token, token_type="bearer")
