# backend/app/api/v1/auth.py - FIXED LOGGING VERSION

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
import os

from app.db.session import get_db
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.schemas.auth import Token, ForgotPasswordRequest, VerifyResetTokenRequest, ResetPasswordRequest
from app.schemas.response import APIResponse
from app.services.auth_service import AuthService
from app.services.email_service import email_service
from app.utils.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Auth"])

# ============================================
# REGISTRATION
# ============================================
@router.post("/register", response_model=APIResponse[UserResponse], status_code=201)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user"""
    user = await AuthService.register_user(db, payload)
    return APIResponse(
        success=True,
        message="User registered successfully",
        data=user,
    )

# ============================================
# LOGIN (✅ Username OR Email)
# ============================================
@router.post("/login", response_model=APIResponse[Token])
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    ✅ UPDATED: Login with username OR email
    
    The frontend sends 'identifier' which can be either username or email
    """
    token = await AuthService.login_user(db, payload.identifier, payload.password)
    return APIResponse(
        success=True,
        message="Login successful",
        data=token,
    )

# ============================================
# GET CURRENT USER
# ============================================
@router.get("/me", response_model=APIResponse[UserResponse])
async def me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user"""
    return APIResponse(
        success=True,
        message="User fetched successfully",
        data=current_user,
    )

# ============================================
# ✅ NEW: FORGOT PASSWORD
# ============================================
@router.post("/forgot-password", response_model=APIResponse[dict])
async def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Request password reset email
    
    Security: Always returns success to prevent user enumeration
    """
    try:
        success, user = await AuthService.request_password_reset(db, payload.identifier)
        
        if success and user:
            # Build reset link
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
            reset_link = f"{frontend_url}/reset-password?token={user.reset_token}"
            
            # ✅ PRINT IMMEDIATELY (not in background task)
            print(f"\n{'='*100}")
            print(f"🔐 PASSWORD RESET REQUESTED")
            print(f"{'='*100}")
            print(f"📧 User: {user.username} ({user.email})")
            print(f"🔗 Reset Link: {reset_link}")
            print(f"🔑 Token: {user.reset_token[:20]}...")
            print(f"⏰ Expires: {user.reset_token_expires}")
            print(f"{'='*100}\n")
            
            # Send email in background
            background_tasks.add_task(
                email_service.send_password_reset_email,
                user.email,
                user.username,
                reset_link
            )
        else:
            print(f"⚠️ Password reset requested for non-existent user: {payload.identifier}")
        
        # Always return success (security best practice)
        return APIResponse(
            success=True,
            message="If an account exists with that username or email, a password reset link has been sent.",
            data={"email_sent": True}
        )
        
    except Exception as e:
        print(f"❌ Error in forgot-password: {e}")
        import traceback
        traceback.print_exc()
        # Still return success to prevent information disclosure
        return APIResponse(
            success=True,
            message="If an account exists with that username or email, a password reset link has been sent.",
            data={"email_sent": True}
        )

# ============================================
# ✅ NEW: VERIFY RESET TOKEN
# ============================================
@router.post("/verify-reset-token", response_model=APIResponse[dict])
async def verify_reset_token(
    payload: VerifyResetTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify if reset token is valid and not expired
    
    Called when user clicks reset link to check if they can proceed
    """
    try:
        user = await AuthService.verify_reset_token(db, payload.token)
        
        print(f"✅ Token verified for user: {user.username}")
        
        return APIResponse(
            success=True,
            message="Token is valid",
            data={
                "valid": True,
                "email": user.email,
                "username": user.username
            }
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Error verifying token: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server error while verifying token"
        )

# ============================================
# ✅ NEW: RESET PASSWORD
# ============================================
@router.post("/reset-password", response_model=APIResponse[dict])
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Reset password using valid token
    
    Token is single-use and will be cleared after successful reset
    """
    try:
        user = await AuthService.reset_password(db, payload.token, payload.new_password)
        
        print(f"\n{'='*100}")
        print(f"✅ PASSWORD RESET SUCCESSFUL")
        print(f"{'='*100}")
        print(f"📧 User: {user.username} ({user.email})")
        print(f"🔒 Password has been changed")
        print(f"{'='*100}\n")
        
        return APIResponse(
            success=True,
            message="Password has been reset successfully",
            data={"password_reset": True}
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Error resetting password: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password"
        )

# ============================================
# HEALTH CHECK
# ============================================
@router.get("/ping", response_model=APIResponse[dict])
async def ping():
    """Health check endpoint"""
    return APIResponse(
        success=True, 
        message="auth alive", 
        data={"message": "auth alive"}
    )