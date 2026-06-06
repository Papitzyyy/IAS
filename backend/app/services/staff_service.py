import json
import threading
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.constants.validators import normalize_email
from app.core.security import hash_password
from app.db.models import AuditAction, User, UserRole
from app.schemas.staff import StaffCreate, StaffPermissionsUpdate
from app.services.audit_service import log_event
from app.services.email_service import send_staff_created_email, send_staff_permissions_email, send_staff_archived_email

def _staff_to_dict(user: User) -> dict:
    try:
        perms = json.loads(user.permissions or "{}")
    except Exception:
        perms = {}
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "middle_name": user.middle_name,
        "last_name": user.last_name,
        "full_name": user.full_name,
        "role": user.role.value,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat(),
        "permissions": perms
    }

def list_staff(db: Session) -> list[dict]:
    staff_users = db.query(User).filter(User.role == UserRole.STAFF).order_by(User.created_at.desc()).all()
    return [_staff_to_dict(s) for s in staff_users]

def create_staff(data: StaffCreate, admin: User, ip: str, db: Session) -> dict:
    email = normalize_email(data.email)
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User with this email already exists.")

    import secrets
    verification_token = secrets.token_urlsafe(32)

    from app.constants.validators import build_full_name
    full_name = build_full_name(data.first_name, data.last_name, data.middle_name)

    staff = User(
        email=email,
        first_name=data.first_name,
        middle_name=data.middle_name,
        last_name=data.last_name,
        full_name=full_name,
        password_hash=hash_password(data.password),
        role=UserRole.STAFF,
        permissions=json.dumps(data.permissions),
        is_verified=False,
        verification_token=verification_token,
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)

    log_event(db, AuditAction.STAFF_CREATED, user_id=admin.id, ip_address=ip,
              detail=f"Staff account {staff.email} created by {admin.email}.")

    from app.services.email_service import send_verification_email
    threading.Thread(
        target=send_verification_email,
        kwargs=dict(to=staff.email, full_name=staff.full_name, admin_name=admin.full_name, token=verification_token),
        daemon=True,
    ).start()

    return _staff_to_dict(staff)

def update_staff(staff_id: str, data: "StaffUpdate", admin: User, ip: str, db: Session) -> dict:
    from app.schemas.staff import StaffUpdate
    staff = db.query(User).filter(User.id == staff_id, User.role == UserRole.STAFF).first()
    if not staff:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff not found.")

    if data.first_name:
        staff.first_name = data.first_name.strip()
    if data.last_name:
        staff.last_name = data.last_name.strip()
    if data.middle_name is not None:
        staff.middle_name = data.middle_name.strip() or None

    if data.first_name or data.last_name or data.middle_name is not None:
        from app.constants.validators import build_full_name
        staff.full_name = build_full_name(staff.first_name, staff.last_name, staff.middle_name)

    if data.email:
        email = normalize_email(str(data.email))
        existing = db.query(User).filter(User.email == email, User.id != staff_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use.")
        staff.email = email

    if data.password:
        staff.password_hash = hash_password(data.password)

    db.commit()
    db.refresh(staff)

    log_event(db, AuditAction.STAFF_UPDATED, user_id=admin.id, ip_address=ip,
              detail=f"Staff {staff.email} updated by {admin.email}.")
    return _staff_to_dict(staff)


def update_staff_permissions(staff_id: str, data: StaffPermissionsUpdate, admin: User, ip: str, db: Session) -> dict:
    staff = db.query(User).filter(User.id == staff_id, User.role == UserRole.STAFF).first()
    if not staff:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found.")

    staff.permissions = json.dumps(data.permissions)
    db.commit()
    db.refresh(staff)

    log_event(db, AuditAction.STAFF_UPDATED, user_id=admin.id, ip_address=ip,
              detail=f"Permissions updated for {staff.email} by {admin.email}.")

    # Notify staff member of their updated access
    threading.Thread(
        target=send_staff_permissions_email,
        kwargs=dict(
            to=staff.email,
            full_name=staff.full_name,
            admin_name=admin.full_name,
            permissions=data.permissions,
        ),
        daemon=True,
    ).start()

    return _staff_to_dict(staff)

def revoke_staff(staff_id: str, admin: User, ip: str, db: Session) -> dict:
    staff = db.query(User).filter(User.id == staff_id, User.role == UserRole.STAFF).first()
    if not staff:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff not found.")

    staff.is_active = False
    db.commit()

    log_event(db, AuditAction.SESSION_REVOKED, user_id=admin.id, ip_address=ip,
              detail=f"Staff {staff.email} revoked by {admin.email}.")
    return {"message": "Staff access revoked."}

def archive_staff(staff_id: str, admin: User, ip: str, db: Session) -> dict:
    """Archive a staff member (soft delete)."""
    staff = db.query(User).filter(User.id == staff_id, User.role == UserRole.STAFF).first()
    if not staff:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff not found.")

    staff.is_active = False
    db.commit()

    log_event(db, AuditAction.STAFF_ARCHIVED, user_id=admin.id, ip_address=ip,
              detail=f"Staff {staff.email} archived by {admin.email}.")

    threading.Thread(
        target=send_staff_archived_email,
        kwargs=dict(to=staff.email, full_name=staff.full_name, admin_name=admin.full_name),
        daemon=True,
    ).start()

    return {"message": "Staff account archived."}

def restore_staff(staff_id: str, admin: User, ip: str, db: Session) -> dict:
    """Restore an archived staff member."""
    staff = db.query(User).filter(User.id == staff_id, User.role == UserRole.STAFF).first()
    if not staff:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff not found.")

    staff.is_active = True
    db.commit()

    log_event(db, AuditAction.STAFF_RESTORED, user_id=admin.id, ip_address=ip,
              detail=f"Staff {staff.email} restored by {admin.email}.")
    return {"message": "Staff account restored."}
