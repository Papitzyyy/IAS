"""
api/v1/students.py
------------------
Student profile management endpoints. Admin only.
"""

import uuid
from typing import List

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, PermissionChecker
from app.db.models import User
from app.schemas.student import StudentCreate, StudentResponse, StudentUpdate
from app.services.student_service import (
    archive_student,
    restore_student,
    create_student,
    get_all_students,
    get_student_response,
    resend_invite,
    start_new_semester,
    update_student,
)

router = APIRouter()


@router.get("", response_model=List[StudentResponse])
def list_students(
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("students", "read")),
):
    return get_all_students(db, include_archived=include_archived)


@router.post("", status_code=201)
def create(
    body: StudentCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("students", "write")),
):
    return create_student(data=body, admin=admin, ip=request.client.host, db=db)


# Static paths MUST be defined before /{student_id} to avoid UUID parsing conflicts
@router.post("/new-semester")
def new_semester(
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("students", "write")),
):
    return start_new_semester(admin=admin, ip=request.client.host, db=db)


@router.get("/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("students", "read")),
):
    return get_student_response(student_id, db)


@router.put("/{student_id}", response_model=StudentResponse)
def update(
    student_id: uuid.UUID,
    body: StudentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("students", "write")),
):
    return update_student(student_id=student_id, data=body, admin=admin, ip=request.client.host, db=db)


@router.post("/{student_id}/archive")
def archive(
    student_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("students", "write")),
):
    return archive_student(student_id=student_id, admin=admin, ip=request.client.host, db=db)


@router.post("/{student_id}/restore")
def restore(
    student_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("students", "write")),
):
    return restore_student(student_id=student_id, admin=admin, ip=request.client.host, db=db)


@router.post("/{student_id}/send-invite")
def send_invite(
    student_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("students", "write")),
):
    return resend_invite(student_id=student_id, admin=admin, ip=request.client.host, db=db)
