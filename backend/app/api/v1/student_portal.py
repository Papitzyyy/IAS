"""
api/v1/student_portal.py
------------------------
Public endpoints for student self-service portal.
No JWT required — token-based auth via query param.
"""

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.schemas.student import StudentSelfUpdate
from app.services.student_portal_service import (
    confirm_continuation,
    get_student_self,
    update_student_self,
)

router = APIRouter()


@router.get("")
def get_my_profile(
    token: str = Query(..., description="Student portal access token"),
    db: Session = Depends(get_db),
):
    """Get a student's own profile data using their portal token."""
    return get_student_self(token, db)


@router.put("")
def update_my_profile(
    body: StudentSelfUpdate,
    request: Request,
    token: str = Query(..., description="Student portal access token"),
    db: Session = Depends(get_db),
):
    """Update a student's own profile data using their portal token."""
    return update_student_self(token, body, request.client.host, db)


@router.post("/continue")
def confirm_semester_continuation(
    request: Request,
    token: str = Query(..., description="Student portal access token"),
    db: Session = Depends(get_db),
):
    """Confirm semester continuation for a student."""
    return confirm_continuation(token, request.client.host, db)
