"""
services/responder_service.py
------------------------------
Business logic for responder account management.
"""

import threading
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password, validate_password_strength
from app.db.models import AuditAction, User, UserRole, PH_TZ
from app.schemas.responder import ResponderCreate, ResponderProfileUpdate
from app.services.audit_service import log_event
from app.services.email_service import send_responder_created_email


def list_responders(db: Session) -> list[dict]:
    responders = db.query(User).filter(User.role == UserRole.RESPONDER).all()
    return [
        {
            "id": str(r.id),
            "email": r.email,
            "first_name": r.first_name,
            "middle_name": r.middle_name,
            "last_name": r.last_name,
            "full_name": r.full_name,
            "is_active": r.is_active,
            "is_verified": r.is_verified,
            "created_at": r.created_at.isoformat(),
        }
        for r in responders
    ]


def create_responder(data: ResponderCreate, admin: User, ip: str, db: Session) -> dict:
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with email {data.email} already exists.",
        )

    pw_errors = validate_password_strength(data.password)
    if pw_errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Password too weak: {pw_errors[0]}",
        )

    import secrets
    verification_token = secrets.token_urlsafe(32)

    from app.constants.validators import build_full_name
    full_name = build_full_name(data.first_name, data.last_name, data.middle_name)

    responder = User(
        email=data.email,
        first_name=data.first_name,
        middle_name=data.middle_name,
        last_name=data.last_name,
        full_name=full_name,
        role=UserRole.RESPONDER,
        password_hash=hash_password(data.password),
        is_verified=False,
        verification_token=verification_token,
    )
    db.add(responder)
    db.commit()
    db.refresh(responder)

    log_event(
        db, AuditAction.RESPONDER_CREATED,
        user_id=str(admin.id),
        ip_address=ip,
        detail=f"Responder account created: {data.email} by admin {admin.email}.",
    )

    from app.services.email_service import send_verification_email
    threading.Thread(
        target=send_verification_email,
        kwargs=dict(to=responder.email, full_name=responder.full_name, admin_name=admin.full_name, token=verification_token),
        daemon=True,
    ).start()

    return {
        "id": str(responder.id),
        "email": responder.email,
        "first_name": responder.first_name,
        "middle_name": responder.middle_name,
        "last_name": responder.last_name,
        "full_name": responder.full_name,
        "is_active": responder.is_active,
        "is_verified": responder.is_verified,
    }


def update_responder(responder_id: str, data: "ResponderUpdate", admin: User, ip: str, db: Session) -> dict:
    from app.schemas.responder import ResponderUpdate  # local import avoids circular
    responder = db.query(User).filter(
        User.id == responder_id,
        User.role == UserRole.RESPONDER,
    ).first()
    if not responder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Responder not found.")

    if data.first_name:
        responder.first_name = data.first_name.strip()
    if data.last_name:
        responder.last_name = data.last_name.strip()
    if data.middle_name is not None:
        responder.middle_name = data.middle_name.strip() or None

    if data.first_name or data.last_name or data.middle_name is not None:
        from app.constants.validators import build_full_name
        responder.full_name = build_full_name(responder.first_name, responder.last_name, responder.middle_name)

    if data.email:
        existing = db.query(User).filter(
            User.email == str(data.email),
            User.id != responder_id,
        ).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use.")
        responder.email = str(data.email)

    if data.password:
        responder.password_hash = hash_password(data.password)

    db.commit()
    db.refresh(responder)

    log_event(
        db, AuditAction.RESPONDER_UPDATED,
        user_id=str(admin.id),
        ip_address=ip,
        detail=f"Responder {responder.email} updated by admin {admin.email}.",
    )

    return {
        "id": str(responder.id),
        "email": responder.email,
        "first_name": responder.first_name,
        "middle_name": responder.middle_name,
        "last_name": responder.last_name,
        "full_name": responder.full_name,
        "is_active": responder.is_active,
        "created_at": responder.created_at.isoformat(),
    }


def revoke_responder(responder_id: str, admin: User, ip: str, db: Session) -> dict:
    if admin.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators are allowed to trigger the responder kill switch.",
        )
    responder = db.query(User).filter(
        User.id == responder_id,
        User.role == UserRole.RESPONDER,
    ).first()
    if not responder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Responder not found.")

    responder.is_active = False
    db.commit()

    log_event(
        db, AuditAction.SESSION_REVOKED,
        user_id=str(admin.id),
        ip_address=ip,
        detail=f"Responder {responder.email} revoked by admin {admin.email}.",
    )

    return {"message": f"Responder {responder.email} has been deactivated."}


def restore_responder(responder_id: str, admin: User, ip: str, db: Session) -> dict:
    if admin.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators are allowed to restore responder accounts.",
        )
    responder = db.query(User).filter(
        User.id == responder_id,
        User.role == UserRole.RESPONDER,
    ).first()
    if not responder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Responder not found.")

    responder.is_active = True
    db.commit()

    log_event(
        db, AuditAction.RESPONDER_RESTORED,
        user_id=str(admin.id),
        ip_address=ip,
        detail=f"Responder {responder.email} restored by admin {admin.email}.",
    )

    return {"message": f"Responder {responder.email} has been restored."}


def get_my_info(current_user: User) -> dict:
    import json
    try:
        perms = json.loads(current_user.permissions or "{}")
    except Exception:
        perms = {}
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "first_name": current_user.first_name,
        "middle_name": current_user.middle_name,
        "last_name": current_user.last_name,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "permissions": perms,
    }


def update_my_profile(
    data: ResponderProfileUpdate, current_user: User, ip: str, db: Session
) -> dict:
    from app.core.config import settings
    from app.core.security import verify_otp
    from app.db.models import OTPCode
    from datetime import datetime, timezone

    if data.first_name:
        current_user.first_name = data.first_name.strip()
    if data.last_name:
        current_user.last_name = data.last_name.strip()
    if data.middle_name is not None:
        current_user.middle_name = data.middle_name.strip() or None

    if data.first_name or data.last_name or data.middle_name is not None:
        from app.constants.validators import build_full_name
        current_user.full_name = build_full_name(current_user.first_name, current_user.last_name, current_user.middle_name)

    if data.email:
        existing = db.query(User).filter(
            User.email == data.email,
            User.id != current_user.id,
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already in use.",
            )
        current_user.email = data.email

    if data.password:
        # OTP is required to change password
        if not data.otp:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="An OTP is required to change your password. Request one first.",
            )

        otp_record = (
            db.query(OTPCode)
            .filter(
                OTPCode.user_id == current_user.id,
                OTPCode.is_used == False,
                OTPCode.expires_at > datetime.now(PH_TZ),
            )
            .order_by(OTPCode.created_at.desc())
            .first()
        )

        if not otp_record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="OTP expired or not found. Request a new one.",
            )

        if otp_record.attempts >= settings.OTP_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed OTP attempts. Request a new one.",
            )

        if not verify_otp(data.otp, otp_record.otp_hash):
            otp_record.attempts += 1
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid OTP. {settings.OTP_MAX_ATTEMPTS - otp_record.attempts} attempt(s) remaining.",
            )

        # OTP valid — mark used, then change password
        otp_record.is_used = True

        pw_errors = validate_password_strength(data.password)
        if pw_errors:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Password too weak: {pw_errors[0]}",
            )
        current_user.password_hash = hash_password(data.password)

    db.commit()
    db.refresh(current_user)

    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "first_name": current_user.first_name,
        "middle_name": current_user.middle_name,
        "last_name": current_user.last_name,
        "full_name": current_user.full_name,
    }
