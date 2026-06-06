"""
api/v1/responders.py
--------------------
Responder account management routes. Admin only (except /me endpoints).

GET    /api/v1/responders              — List all responder accounts
POST   /api/v1/responders              — Create a new responder account
GET    /api/v1/responders/me-info      — Get current user info (any role)
PUT    /api/v1/responders/me           — User updates their own profile (any role)
PUT    /api/v1/responders/{id}         — Admin updates a responder
POST   /api/v1/responders/{id}/revoke  — Revoke (deactivate) a responder
POST   /api/v1/responders/{id}/restore — Restore a deactivated responder
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user, require_admin, PermissionChecker
from app.db.models import User
from app.schemas.responder import ResponderCreate, ResponderUpdate, ResponderProfileUpdate
from app.services.responder_service import (
    create_responder,
    get_my_info,
    list_responders,
    restore_responder,
    revoke_responder,
    update_responder,
    update_my_profile,
)

router = APIRouter()


@router.get("")
def list_responders_route(
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("responders", "read")),
):
    return list_responders(db)


@router.post("", status_code=201)
def create_responder_route(
    body: ResponderCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("responders", "write")),
):
    return create_responder(data=body, admin=admin, ip=request.client.host, db=db)


# ── Self-service endpoints (any authenticated user) ─────────────────────────
# IMPORTANT: These MUST be defined BEFORE /{responder_id} routes, otherwise
# FastAPI matches "me" / "me-info" as a responder_id path parameter.


@router.get("/me-info")
def get_my_info_route(current_user: User = Depends(get_current_user)):
    return get_my_info(current_user)


@router.put("/me")
def update_my_profile_route(
    body: ResponderProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_my_profile(data=body, current_user=current_user, ip=request.client.host, db=db)


# ── Admin-managed endpoints (require responders:write) ──────────────────────


@router.put("/{responder_id}")
def update_responder_route(
    responder_id: str,
    body: ResponderUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("responders", "write")),
):
    return update_responder(responder_id=responder_id, data=body, admin=admin, ip=request.client.host, db=db)


@router.post("/{responder_id}/revoke")
def revoke_responder_route(
    responder_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("responders", "write")),
):
    return revoke_responder(responder_id=responder_id, admin=admin, ip=request.client.host, db=db)


@router.post("/{responder_id}/restore")
def restore_responder_route(
    responder_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("responders", "write")),
):
    return restore_responder(responder_id=responder_id, admin=admin, ip=request.client.host, db=db)
