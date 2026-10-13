# backend/app/api/dependencies.py

import logging
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError, jwt

from app.db.session import get_db
from app.models.user import User
from app.services import sessions
from app.services.admin import SUSPENDED
from app.config.settings import settings

logger = logging.getLogger(__name__)

# HTTP Bearer token scheme
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependency to get current authenticated user from JWT token
    
    Usage in routes:
        @router.get("/protected")
        async def protected_route(current_user: User = Depends(get_current_user)):
            return {"user": current_user.username}
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Extract token from credentials
        token = credentials.credentials

        # Decode JWT token
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )

        # Refresh tokens can only be used at /auth/refresh
        if payload.get("type") == "refresh":
            raise credentials_exception

        # Get user ID from token payload
        user_id = UUID(str(payload.get("sub")))

    except (JWTError, ValueError) as e:
        # Expired/invalid tokens are routine (clients refresh on 401)
        logger.debug("Rejected token: %s", e)
        raise credentials_exception

    # Database errors propagate (500), they are not an authentication failure
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        logger.warning("Valid token for missing user %s", user_id)
        raise credentials_exception
    # A deleted account signs out like a logged-out session (apps sign out on 401)
    if user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="This account was deleted", headers={"WWW-Authenticate": "Bearer"})
    # Suspended by an app admin: the apps sign out (without wiping keys) and the next sign-in says why
    if user.suspended_now():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=SUSPENDED, headers={"WWW-Authenticate": "Bearer"})
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    # Logged out (here or from another device): the sign-in's tokens no longer work
    if not await sessions.is_active(db, payload.get("sid"), user.id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=sessions.LOGGED_OUT, headers={"WWW-Authenticate": "Bearer"})
    return user


async def get_app_admin(user: User = Depends(get_current_user)) -> User:
    """App admins only (the admin console). Set with scripts/make_admin.py."""
    if not user.is_app_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only app admins can do this")
    return user

