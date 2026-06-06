from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List

from app.core.dependencies import get_db, require_admin
from app.db.models import AuditAction, User, UserRole
from app.schemas.staff import StaffCreate, StaffPermissionsUpdate, StaffResponse, StaffUpdate
from app.services.audit_service import log_event
from app.services.staff_service import create_staff, list_staff, update_staff, update_staff_permissions, revoke_staff, archive_staff, restore_staff

router = APIRouter()

@router.get("", response_model=List[StaffResponse])
def get_staff_list(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    return list_staff(db)

@router.post("", status_code=201, response_model=StaffResponse)
def create_staff_member(
    body: StaffCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    return create_staff(data=body, admin=admin, ip=request.client.host, db=db)

@router.put("/{staff_id}", response_model=StaffResponse)
def update_staff_member(
    staff_id: str,
    body: StaffUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    return update_staff(staff_id=staff_id, data=body, admin=admin, ip=request.client.host, db=db)


@router.put("/{staff_id}/permissions", response_model=StaffResponse)
def update_permissions(
    staff_id: str,
    body: StaffPermissionsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    return update_staff_permissions(staff_id=staff_id, data=body, admin=admin, ip=request.client.host, db=db)

@router.post("/{staff_id}/revoke")
def revoke_staff_member(
    staff_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    return revoke_staff(staff_id=staff_id, admin=admin, ip=request.client.host, db=db)

@router.post("/{staff_id}/archive")
def archive_staff_member(
    staff_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    return archive_staff(staff_id=staff_id, admin=admin, ip=request.client.host, db=db)

@router.post("/{staff_id}/restore")
def restore_staff_member(
    staff_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    return restore_staff(staff_id=staff_id, admin=admin, ip=request.client.host, db=db)

@router.delete("/{staff_id}")
def delete_staff_member(
    staff_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Permanently delete a staff member."""
    staff = db.query(User).filter(User.id == staff_id, User.role == UserRole.STAFF).first()
    if not staff:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff not found.")

    email = staff.email
    db.delete(staff)
    db.commit()

    log_event(
        db,
        AuditAction.STAFF_DELETED,
        user_id=admin.id,
        ip_address=request.client.host,
        detail=f"Staff {email} permanently deleted by {admin.email}.",
    )
    return {"message": "Staff account permanently deleted."}
