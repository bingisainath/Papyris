from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.schemas.auth import Token
from app.schemas.response import APIResponse
from app.services.auth_service import AuthService
from app.utils.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/register", response_model=APIResponse[UserResponse], status_code=201)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    user = await AuthService.register_user(db, payload)
    return APIResponse(
        success=True,
        message="User registered successfully",
        data=user,
    )

@router.post("/login", response_model=APIResponse[Token])
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    token = await AuthService.login_user(db, payload.email, payload.password)
    return APIResponse(
        success=True,
        message="Login successful",
        data=token,
    )

@router.get("/me", response_model=APIResponse[UserResponse])
async def me(current_user: User = Depends(get_current_user)):
    return APIResponse(
        success=True,
        message="User fetched successfully",
        data=current_user,
    )

@router.get("/ping", response_model=APIResponse[dict])
async def ping():
    return APIResponse(success=True, message="auth alive", data={"message": "auth alive"})
