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
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    return user


# Optional: Dependency for admin-only routes
async def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency for admin-only routes
    """
    # You can add an 'is_admin' field to your User model
    # For now, just return the user
    return current_user