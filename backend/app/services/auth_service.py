"""
services/auth_service.py
------------------------
Business logic for authentication flows.
- Validate credentials
- Generate and verify OTPs
- Issue JWTs
- Handle account lockout
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.db.models import PH_TZ

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_otp,
    hash_otp,
    verify_otp,
    verify_password,
    hash_password,
    validate_password_strength,
)
from app.db.models import AuditAction, OTPCode, User, UserRole
from app.services.audit_service import log_event
from app.services.email_service import send_otp_email, send_password_reset_email


from collections import defaultdict

# In-memory store for tracking failed password attempts: {email: [datetime1, datetime2, ...]}
FAILED_LOGINS = defaultdict(list)

def initiate_login(email: str, password: str, ip: str, db: Session, background_tasks: BackgroundTasks, source: str = None) -> dict:
    """
    Step 1 of MFA login.
    Validates credentials, generates an OTP, and sends it via email.
    Returns a message confirming OTP was sent.
    """
    now = datetime.now(PH_TZ).replace(tzinfo=None)
    
    # 1. Clean up old attempts for this email (older than 15 minutes)
    if email in FAILED_LOGINS:
        FAILED_LOGINS[email] = [t for t in FAILED_LOGINS[email] if (now - t).total_seconds() < 900]
        # 2. Check if locked
        if len(FAILED_LOGINS[email]) >= 3:
            oldest_attempt = FAILED_LOGINS[email][0]
            remaining = 900 - (now - oldest_attempt).total_seconds()
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account locked due to too many failed attempts. Try again in {int(remaining / 60) + 1} minutes."
            )

    user = db.query(User).filter(User.email == email, User.is_active == True).first()

    if user and user.otp_locked_until:
        locked_until = user.otp_locked_until.replace(tzinfo=None) if user.otp_locked_until.tzinfo else user.otp_locked_until
        if locked_until > now:
            remaining = (locked_until - now).total_seconds() / 60
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account locked due to too many failed attempts. Try again in {int(remaining) + 1} minutes."
            )

    if user:
        # Responders are mobile-only — block web portal login entirely
        if user.role == UserRole.RESPONDER and source == "web":
            log_event(db, AuditAction.UNAUTHORIZED_REQUEST, user_id=user.id, ip_address=ip,
                      detail=f"Responder {user.email} attempted web portal login.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The website is for admin and staff only.",
            )

        # Admin/Staff are web-only — block mobile app login entirely
        if user.role != UserRole.RESPONDER and source == "mobile":
            log_event(db, AuditAction.UNAUTHORIZED_REQUEST, user_id=user.id, ip_address=ip,
                      detail=f"{user.role.value} {user.email} attempted mobile app login.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This app is for CRCY Responder only.",
            )

        if not user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please verify your email address first. Check your inbox for the confirmation link.",
            )

    if not user or not verify_password(password, user.password_hash):
        log_event(db, AuditAction.LOGIN_FAILURE, ip_address=ip,
                  detail=f"Failed login attempt for email: {email}")
        FAILED_LOGINS[email].append(now)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    # Successful login, clear failed attempts
    if email in FAILED_LOGINS:
        del FAILED_LOGINS[email]

    # Invalidate any existing pending login attempts for this user
    from app.db.models import LoginAttempt
    import uuid
    import secrets

    db.query(LoginAttempt).filter(
        LoginAttempt.user_id == user.id,
        LoginAttempt.is_authorized == False,
    ).delete()

    auth_token = secrets.token_urlsafe(32)
    attempt = LoginAttempt(
        user_id=user.id,
        auth_token=auth_token,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=60),
    )
    db.add(attempt)
    db.commit()

    from app.services.email_service import send_login_authorization_email
    background_tasks.add_task(send_login_authorization_email, user.email, user.full_name, auth_token, ip)

    return {"message": "Authorization email sent.", "attempt_id": attempt.id}



def verify_otp_and_issue_token(email: str, otp: str, ip: str, db: Session) -> dict:
    """
    Step 2 of MFA login.
    Verifies the OTP and issues a JWT on success.
    Enforces lockout after OTP_MAX_ATTEMPTS failed attempts.
    """
    user = db.query(User).filter(User.email == email, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid request.")

    if user.otp_locked_until:
        locked_until = user.otp_locked_until.replace(tzinfo=None) if user.otp_locked_until.tzinfo else user.otp_locked_until
        now = datetime.now(PH_TZ).replace(tzinfo=None)
        if locked_until > now:
            remaining = (locked_until - now).total_seconds() / 60
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account locked due to too many failed attempts. Try again in {int(remaining) + 1} minutes."
            )

    otp_record = (
        db.query(OTPCode)
        .filter(
            OTPCode.user_id == user.id,
            OTPCode.is_used == False,
            OTPCode.expires_at > datetime.now(timezone.utc),
        )
        .order_by(OTPCode.created_at.desc())
        .first()
    )

    if not otp_record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="OTP expired or not found.")

    if otp_record.attempts >= settings.OTP_MAX_ATTEMPTS:
        log_event(db, AuditAction.LOGIN_FAILURE, user_id=user.id, ip_address=ip,
                  detail="Account locked: max OTP attempts exceeded.")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Request a new OTP.",
        )

    if not verify_otp(otp, otp_record.otp_hash):
        otp_record.attempts += 1
        user.failed_otp_attempts += 1
        
        if user.failed_otp_attempts >= settings.OTP_MAX_ATTEMPTS:
            user.otp_locked_until = datetime.now(PH_TZ) + timedelta(minutes=15)
            user.failed_otp_attempts = 0  # reset attempts counter for next login block
            db.commit()
            log_event(db, AuditAction.LOGIN_FAILURE, user_id=user.id, ip_address=ip,
                      detail="Account locked: 3 consecutive failed OTP attempts.")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed attempts. Your account has been locked for 15 minutes."
            )
            
        db.commit()
        log_event(db, AuditAction.LOGIN_FAILURE, user_id=user.id, ip_address=ip,
                  detail=f"Invalid OTP attempt {otp_record.attempts}/{settings.OTP_MAX_ATTEMPTS}.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid OTP. {settings.OTP_MAX_ATTEMPTS - user.failed_otp_attempts} attempt(s) remaining."
        )

    # OTP is valid — mark as used, reset failed attempts and lockout, and issue JWT
    otp_record.is_used = True
    user.failed_otp_attempts = 0
    user.otp_locked_until = None
    db.commit()

    expire_minutes = (
        settings.ACCESS_TOKEN_EXPIRE_MINUTES_ADMIN
        if user.role == UserRole.ADMIN
        else settings.ACCESS_TOKEN_EXPIRE_MINUTES_RESPONDER
    )
    token = create_access_token(
        data={"sub": str(user.id), "role": user.role.value},
        expires_delta=timedelta(minutes=expire_minutes),
    )

    log_event(db, AuditAction.LOGIN_SUCCESS, user_id=user.id, ip_address=ip)

    return {"access_token": token, "token_type": "bearer", "role": user.role.value}


def request_otp_for_password_change(user: User, ip: str, db: Session, background_tasks: BackgroundTasks) -> dict:
    """
    Send a fresh OTP to the logged-in user's email.
    Used to verify identity before allowing a password change.
    """
    # Invalidate any existing unused OTPs
    db.query(OTPCode).filter(
        OTPCode.user_id == user.id,
        OTPCode.is_used == False,
    ).delete()

    otp = generate_otp()
    otp_record = OTPCode(
        user_id=user.id,
        otp_hash=hash_otp(otp),
        expires_at=datetime.now(PH_TZ) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
    )
    db.add(otp_record)
    db.commit()

    background_tasks.add_task(send_otp_email, user.email, otp, user.full_name)

    return {"message": "OTP sent to your registered email. Enter it to confirm your password change."}


def revoke_session(user_id: str, admin: User, ip: str, db: Session) -> dict:
    """Admin kill switch: deactivate a user account, invalidating their JWT on next request."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    target.is_active = False
    db.commit()

    log_event(
        db, AuditAction.SESSION_REVOKED,
        user_id=admin.id,
        ip_address=ip,
        detail=f"Session revoked for user {target.email} by admin {admin.email}.",
    )

    return {"message": f"Session for {target.email} has been revoked."}


def initiate_forgot_password(email: str, ip: str, db: Session, background_tasks: BackgroundTasks) -> dict:
    """
    Initiate the forgot password flow.
    Generates and sends a 6-digit OTP code to the requested email.
    """
    user = db.query(User).filter(User.email == email, User.is_active == True).first()
    if not user:
        # In a generic public system we might obfuscate this, but for internal clinic portal
        # letting the user know if their email is invalid is much friendlier.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User with this email was not found.",
        )

    # Invalidate any existing unused OTPs for this user
    db.query(OTPCode).filter(
        OTPCode.user_id == user.id,
        OTPCode.is_used == False,
    ).delete()

    otp = generate_otp()
    otp_record = OTPCode(
        user_id=user.id,
        otp_hash=hash_otp(otp),
        expires_at=datetime.now(PH_TZ) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
    )
    db.add(otp_record)
    db.commit()

    background_tasks.add_task(send_password_reset_email, user.email, otp, user.full_name)

    log_event(
        db, AuditAction.STAFF_UPDATED,
        user_id=user.id,
        ip_address=ip,
        detail=f"Requested password reset OTP for {user.email}."
    )

    return {"message": "A password reset code has been sent to your registered email."}


def reset_password_with_otp(email: str, otp: str, new_password: str, confirm_password: str, ip: str, db: Session) -> dict:
    """
    Verify OTP and reset the user's password.
    """
    if new_password != confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match.",
        )

    pw_errors = validate_password_strength(new_password)
    if pw_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is too weak: " + pw_errors[0],
        )

    user = db.query(User).filter(User.email == email, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    otp_record = (
        db.query(OTPCode)
        .filter(
            OTPCode.user_id == user.id,
            OTPCode.is_used == False,
            OTPCode.expires_at > datetime.now(timezone.utc),
        )
        .order_by(OTPCode.created_at.desc())
        .first()
    )

    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired or not found. Please request a new code.",
        )

    if otp_record.attempts >= settings.OTP_MAX_ATTEMPTS:
        log_event(db, AuditAction.LOGIN_FAILURE, user_id=user.id, ip_address=ip,
                  detail="Password reset failed: max OTP attempts exceeded.")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Request a new OTP.",
        )

    if not verify_otp(otp, otp_record.otp_hash):
        otp_record.attempts += 1
        db.commit()
        log_event(db, AuditAction.LOGIN_FAILURE, user_id=user.id, ip_address=ip,
                  detail=f"Invalid password reset OTP attempt {otp_record.attempts}/{settings.OTP_MAX_ATTEMPTS}.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP.",
        )

    # OTP verified! Mark as used and update password hash
    otp_record.is_used = True
    user.password_hash = hash_password(new_password)
    db.commit()

    log_event(
        db, AuditAction.STAFF_UPDATED,
        user_id=user.id,
        ip_address=ip,
        detail=f"Successfully reset password using OTP for {user.email}."
    )

    return {"message": "Your password has been reset successfully. You can now log in with your new password."}


def authorize_login_attempt(token: str, db: Session, background_tasks: BackgroundTasks) -> dict:
    from fastapi.responses import HTMLResponse
    from app.db.models import LoginAttempt
    from datetime import timezone as _tz
    
    attempt = db.query(LoginAttempt).filter(LoginAttempt.auth_token == token).first()
    if not attempt:
        return HTMLResponse("<h1>Invalid or expired link.</h1><p>Please try logging in again.</p>", status_code=400)
    
    if attempt.is_authorized:
        return HTMLResponse("<h1>Already authorized.</h1><p>You can check your original device now.</p>")

    # Always compare in UTC to avoid timezone mismatch bugs
    now_utc = datetime.now(_tz.utc)
    expires_at = attempt.expires_at
    # Ensure expires_at is UTC-aware (PostgreSQL returns UTC-aware datetimes with timezone=True columns)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=_tz.utc)
    else:
        expires_at = expires_at.astimezone(_tz.utc)

    if expires_at < now_utc:
        return HTMLResponse("<h1>Link expired.</h1><p>Please try logging in again.</p>", status_code=400)

    # Mark as authorized
    attempt.is_authorized = True
    
    # Now generate and send the actual OTP
    user = attempt.user
    
    # Invalidate any existing unused OTPs
    db.query(OTPCode).filter(
        OTPCode.user_id == user.id,
        OTPCode.is_used == False,
    ).delete()

    otp = generate_otp()
    otp_record = OTPCode(
        user_id=user.id,
        otp_hash=hash_otp(otp),
        expires_at=datetime.now(_tz.utc) + timedelta(seconds=60),
    )
    db.add(otp_record)
    db.commit()

    background_tasks.add_task(send_otp_email, user.email, otp, user.full_name)
    
    return HTMLResponse(
        "<h1>Login Authorized!</h1>"
        "<p>We have sent a 6-digit code to your email. Please enter it on your original device within <strong>60 seconds</strong> to finish logging in.</p>"
        "<p>You can close this window.</p>"
    )


def check_login_status(attempt_id: str, db: Session) -> dict:
    from app.db.models import LoginAttempt
    attempt = db.query(LoginAttempt).filter(LoginAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
        
    return {"is_authorized": attempt.is_authorized}
