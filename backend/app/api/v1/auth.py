"""
api/v1/auth.py
--------------
Authentication routes.

POST /api/v1/auth/login                    — Step 1: validate credentials, send OTP
POST /api/v1/auth/verify-otp               — Step 2: verify OTP, receive JWT
POST /api/v1/auth/request-password-otp     — Logged-in user: send OTP to change password
POST /api/v1/auth/revoke/{user_id}         — Admin: revoke a user session
"""

from fastapi import APIRouter, Depends, Request, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user, require_admin
from app.db.models import User
from app.schemas.auth import LoginRequest, OTPVerifyRequest, TokenResponse, ForgotPasswordRequest, ResetPasswordRequest
from app.services.auth_service import (
    initiate_login,
    request_otp_for_password_change,
    revoke_session,
    verify_otp_and_issue_token,
    initiate_forgot_password,
    reset_password_with_otp,
)

from fastapi.responses import RedirectResponse
from app.core.config import settings

router = APIRouter()

@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.verification_token == token).first()
    frontend_url = settings.FRONTEND_URL.rstrip('/') + "/pages/login.html"
    
    if not user:
        return RedirectResponse(url=f"{frontend_url}?verified=0")
        
    user.is_verified = True
    user.verification_token = None
    db.commit()
    
    return RedirectResponse(url=f"{frontend_url}?verified=1")


@router.post("/login")
def login(request: Request, body: LoginRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    return initiate_login(email=body.email, password=body.password, ip=request.client.host, db=db, background_tasks=background_tasks, source=body.source)


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(request: Request, body: OTPVerifyRequest, db: Session = Depends(get_db)):
    return verify_otp_and_issue_token(
        email=body.email, otp=body.otp, ip=request.client.host, db=db
    )


@router.post("/request-password-otp")
def request_password_otp(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send an OTP to the logged-in user's email so they can verify before changing password."""
    return request_otp_for_password_change(user=current_user, ip=request.client.host, db=db, background_tasks=background_tasks)


@router.post("/revoke/{user_id}")
def revoke_session_route(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return revoke_session(user_id=user_id, admin=admin, ip=request.client.host, db=db)


@router.post("/forgot-password")
def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Initiates a password reset by sending an OTP to the user's registered email."""
    return initiate_forgot_password(email=body.email, ip=request.client.host, db=db, background_tasks=background_tasks)


@router.post("/reset-password")
def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """Verifies the password reset OTP and updates the user's password."""
    return reset_password_with_otp(
        email=body.email,
        otp=body.otp,
        new_password=body.new_password,
        confirm_password=body.confirm_password,
        ip=request.client.host,
        db=db
    )


@router.get("/authorize-login")
def authorize_login(token: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """User clicks this link from their email to verify their login attempt."""
    from app.services.auth_service import authorize_login_attempt
    return authorize_login_attempt(token, db, background_tasks)


@router.get("/login-status/{attempt_id}")
def get_login_status(attempt_id: str, db: Session = Depends(get_db)):
    """Frontend polls this to check if the user has clicked the email link."""
    from app.services.auth_service import check_login_status
    return check_login_status(attempt_id, db)

