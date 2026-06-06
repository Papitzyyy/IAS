"""
services/student_portal_service.py
-----------------------------------
Business logic for the student self-service portal.
Students access their profile via a secure token link (no login required).
"""

import hashlib
import threading
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.constants.validators import build_full_name
from app.db.models import AuditAction, PH_TZ, QRTag, Student, StudentToken
from app.schemas.student import StudentSelfUpdate
from app.services.audit_service import log_event


def _validate_token(token: str, db: Session) -> Student:
    """Validate a student portal token and return the associated Student."""
    if not token or len(token) < 20:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing access token.",
        )

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    st = db.query(StudentToken).filter(
        StudentToken.token_hash == token_hash,
        StudentToken.is_active == True,
    ).first()

    if not st:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired access token.",
        )

    student = db.query(Student).filter(Student.id == st.student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student record not found.",
        )

    return student


def _student_portal_dict(student: Student, db: Session) -> dict:
    """Build the student data dict for the portal response."""
    active = (
        db.query(QRTag)
        .filter(QRTag.student_id == student.id, QRTag.is_active == True)
        .first()
    )
    return {
        "id": student.id,
        "student_number": student.student_number,
        "first_name": student.first_name,
        "middle_name": student.middle_name,
        "last_name": student.last_name,
        "suffix": student.suffix,
        "full_name": student.full_name,
        "email": student.email,
        "program": student.program,
        "gender": student.gender,
        "age": student.age,
        "address": student.address,
        "contact_number": student.contact_number,
        "birthdate": student.birthdate,
        "place_of_birth": student.place_of_birth,
        "guardian_first_name": student.guardian_first_name,
        "guardian_middle_name": student.guardian_middle_name,
        "guardian_last_name": student.guardian_last_name,
        "guardian_contact": student.guardian_contact,
        "guardian_address": student.guardian_address,
        "blood_type": student.blood_type,
        "hypertension": student.hypertension,
        "hypertension_medication": student.hypertension_medication,
        "health_disease": student.health_disease,
        "health_disease_diagnosis": student.health_disease_diagnosis,
        "covid_vaccinated": student.covid_vaccinated,
        "covid_dose1": student.covid_dose1,
        "covid_dose2": student.covid_dose2,
        "covid_booster": student.covid_booster,
        "covid_vaccine_brand": student.covid_vaccine_brand,
        "food_allergy": student.food_allergy,
        "food_allergy_specify": student.food_allergy_specify,
        "drug_allergy": student.drug_allergy,
        "drug_allergy_specify": student.drug_allergy_specify,
        "diabetes": student.diabetes,
        "diabetes_medication": student.diabetes_medication,
        "history_of_surgery": student.history_of_surgery,
        "surgery_procedure": student.surgery_procedure,
        "mental_health": student.mental_health,
        "mental_health_notes": student.mental_health_notes,
        "is_archived": student.is_archived,
        "has_active_tag": active is not None,
        "enrollment_status": student.enrollment_status or "active",
        "enrollment_deadline": student.enrollment_deadline.isoformat() if student.enrollment_deadline else None,
        "last_confirmed_at": student.last_confirmed_at.isoformat() if student.last_confirmed_at else None,
    }


def get_student_self(token: str, db: Session) -> dict:
    """Get a student's own profile data via their portal token."""
    student = _validate_token(token, db)
    return _student_portal_dict(student, db)


def update_student_self(token: str, data: StudentSelfUpdate, ip: str, db: Session) -> dict:
    """Update a student's own profile data via their portal token."""
    student = _validate_token(token, db)

    if student.is_archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit an archived record.",
        )

    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(student, field, value)

    # Recompute full_name if name parts changed
    if any(k in updates for k in ("first_name", "middle_name", "last_name", "suffix")):
        student.full_name = build_full_name(
            student.first_name or "",
            student.last_name or "",
            student.middle_name,
            student.suffix,
        )

    db.commit()
    db.refresh(student)

    log_event(
        db,
        AuditAction.STUDENT_SELF_UPDATED,
        user_id=None,
        ip_address=ip,
        detail=f"Student {student.student_number} updated their own profile via the portal.",
    )

    return _student_portal_dict(student, db)


def confirm_continuation(token: str, ip: str, db: Session) -> dict:
    """Confirm semester continuation for a student."""
    student = _validate_token(token, db)

    if student.is_archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot confirm continuation for an archived record.",
        )

    if student.enrollment_status != "pending_continuation":
        return {
            "message": "Your enrollment is already active.",
            "enrollment_status": student.enrollment_status,
        }

    now = datetime.now(PH_TZ)
    student.enrollment_status = "active"
    student.last_confirmed_at = now
    student.enrollment_deadline = None
    db.commit()

    log_event(
        db,
        AuditAction.STUDENT_CONTINUED,
        user_id=None,
        ip_address=ip,
        detail=f"Student {student.student_number} confirmed semester continuation.",
    )

    return {
        "message": "Thank you! Your enrollment has been confirmed for the new semester.",
        "enrollment_status": "active",
    }
