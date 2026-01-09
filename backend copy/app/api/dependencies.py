# backend/app/api/dependencies.py

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError, jwt

from app.db.session import get_db
from app.models.user import User
from app.config.settings import settings

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

        # Get user ID from token payload
        user_id: str = payload.get("sub")
        if user_id is None:
            print("❌ JWT Error: No 'sub' in token payload")
            raise credentials_exception

    except JWTError as e:
        print(f"❌ JWT Error: {e}")
        raise credentials_exception
    except Exception as e:
        print(f"❌ Unexpected error decoding JWT: {e}")
        raise credentials_exception

    # Query user from database
    try:
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user is None:
            print(f"❌ User not found: {user_id}")
            raise credentials_exception

        return user

    except Exception as e:
        print(f"❌ Database error fetching user: {e}")
        raise credentials_exception


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