"""
api/v1/tags.py
--------------
QR tag routes.

GET  /api/v1/tags                           — Admin: list all tags
GET  /api/v1/scan-tag/{qr_payload}          — Responder: scan a QR tag
POST /api/v1/tags                           — Admin: create a tag for a student
GET  /api/v1/deactivate-tag/{token_uuid}    — Student: one-click deactivate via email link
POST /api/v1/tags/{tag_id}/deactivate       — Admin: deactivate a tag manually

GET  /api/v1/search-students                — Responder: Search student by name/ID
GET  /api/v1/student-profile/{student_number} — Responder: Load profile after search
"""

import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_admin, require_responder, PermissionChecker
from app.db.models import User
from app.schemas.tag import ScanResponse, TagCreateRequest, TagResponse
from app.services.tag_service import (
    create_tag,
    deactivate_tag_by_admin,
    deactivate_tag_by_student,
    list_tags,
    scan_tag,
    search_students_for_responder,
    get_student_profile_for_responder,
)

router = APIRouter()


@router.get("/tags")
def list_tags_route(
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("tags", "read")),
):
    return list_tags(db)


@router.get("/scan-tag/{qr_payload:path}", response_model=ScanResponse)
def scan_route(
    qr_payload: str,
    request: Request,
    db: Session = Depends(get_db),
    responder: User = Depends(require_responder),
):
    return scan_tag(qr_payload=qr_payload, responder=responder, ip=request.client.host, db=db)


@router.get("/search-students")
def search_students_route(
    query: str,
    request: Request,
    db: Session = Depends(get_db),
    responder: User = Depends(require_responder),
):
    return search_students_for_responder(query=query, responder=responder, ip=request.client.host, db=db)


@router.get("/student-profile/{student_number}", response_model=ScanResponse)
def student_profile_route(
    student_number: str,
    request: Request,
    db: Session = Depends(get_db),
    responder: User = Depends(require_responder),
):
    return get_student_profile_for_responder(student_number=student_number, responder=responder, ip=request.client.host, db=db)


@router.post("/tags", response_model=TagResponse)
def create_route(
    body: TagCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("tags", "write")),
):
    return create_tag(student_id=body.student_id, admin=admin, db=db)


@router.get("/deactivate-tag/{token_uuid}")
def deactivate_by_student_route(
    token_uuid: str,
    request: Request,
    sig: str = Query(..., description="HMAC signature from the email deactivation link"),
    db: Session = Depends(get_db),
):
    return deactivate_tag_by_student(
        token_uuid_str=token_uuid, signature=sig, ip=request.client.host, db=db
    )


@router.post("/tags/{tag_id}/deactivate")
def deactivate_by_admin_route(
    tag_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("tags", "write")),
):
    return deactivate_tag_by_admin(tag_id=tag_id, admin=admin, ip=request.client.host, db=db)
