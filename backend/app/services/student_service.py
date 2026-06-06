"""
services/student_service.py
----------------------------
Business logic for student profile management.
"""

import hashlib
import secrets
import threading
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from app.db.models import PH_TZ

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.constants.validators import build_full_name, normalize_email
from app.db.models import AuditAction, QRTag, Student, StudentToken, User, UserRole
from app.schemas.student import StudentCreate, StudentUpdate
from app.services.audit_service import log_event
from app.services.email_service import send_tag_deactivated_email, send_student_updated_email
from app.services.tag_service import create_tag


def _student_to_dict(student: Student, db: Session) -> dict:
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
        "archived_at": student.archived_at.isoformat() if student.archived_at else None,
        "has_active_tag": active is not None,
        "enrollment_status": student.enrollment_status or "active",
        "enrollment_deadline": student.enrollment_deadline.isoformat() if student.enrollment_deadline else None,
        "last_confirmed_at": student.last_confirmed_at.isoformat() if student.last_confirmed_at else None,
    }


def _check_duplicate_email(email: str, db: Session, exclude_id: Optional[str] = None) -> None:
    q = db.query(Student).filter(Student.email == normalize_email(email))
    if exclude_id:
        q = q.filter(Student.id != str(exclude_id))
    if q.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A student with this email already exists.",
        )


def create_student(data: StudentCreate, admin: User, ip: str, db: Session) -> dict:
    existing = db.query(Student).filter(Student.student_number == data.student_number).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Student number {data.student_number} already exists.",
        )
    _check_duplicate_email(data.email, db)

    payload = data.model_dump(exclude={"generate_tag"})
    payload["email"] = normalize_email(payload["email"])
    payload["full_name"] = data.computed_full_name
    payload["created_by"] = admin.id

    student = Student(**payload)
    db.add(student)
    db.commit()
    db.refresh(student)

    log_event(
        db,
        AuditAction.STUDENT_CREATED,
        user_id=admin.id,
        ip_address=ip,
        detail=f"Student {student.student_number} created by {admin.email}.",
    )

    result = _student_to_dict(student, db)

    from app.services.email_service import send_student_created_email
    if student.email:
        threading.Thread(
            target=send_student_created_email,
            kwargs=dict(to=student.email, full_name=student.full_name, student_number=student.student_number),
            daemon=True,
        ).start()

    if data.generate_tag:
        try:
            tag = create_tag(uuid.UUID(student.id), admin, db)
            result["tag"] = tag
        except HTTPException as exc:
            result["tag_error"] = exc.detail

    # Generate a student portal token and send invite email
    raw_token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    st = StudentToken(student_id=student.id, token_hash=token_hash)
    db.add(st)
    db.commit()

    log_event(
        db,
        AuditAction.STUDENT_INVITED,
        user_id=admin.id,
        ip_address=ip,
        detail=f"Invite link sent to {student.email} for student {student.student_number}.",
    )

    from app.services.email_service import send_student_invite_email
    if student.email:
        threading.Thread(
            target=send_student_invite_email,
            kwargs=dict(
                to=student.email,
                full_name=student.full_name,
                student_number=student.student_number,
                token=raw_token,
            ),
            daemon=True,
        ).start()

    return result


def get_all_students(db: Session, include_archived: bool = False) -> List[dict]:
    q = db.query(Student)
    if not include_archived:
        q = q.filter(Student.is_archived == False)
    students = q.order_by(Student.full_name).all()
    return [_student_to_dict(s, db) for s in students]


def get_student_by_id(student_id, db: Session) -> Student:
    student = db.query(Student).filter(Student.id == str(student_id)).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")
    return student


def get_student_response(student_id, db: Session) -> dict:
    student = get_student_by_id(student_id, db)
    return _student_to_dict(student, db)


def update_student(
    student_id: uuid.UUID, data: StudentUpdate, admin: User, ip: str, db: Session
) -> dict:
    student = get_student_by_id(student_id, db)
    if student.is_archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit an archived student. Restore the record first.",
        )

    updates = data.model_dump(exclude_unset=True)
    if "email" in updates and updates["email"]:
        updates["email"] = normalize_email(updates["email"])
        _check_duplicate_email(updates["email"], db, exclude_id=student.id)

    for field, value in updates.items():
        setattr(student, field, value)

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
        AuditAction.STUDENT_UPDATED,
        user_id=admin.id,
        ip_address=ip,
        detail=f"Student {student.student_number} updated by {admin.email}.",
    )

    # Send email notification about updated medical details
    if student.email:
        threading.Thread(
            target=send_student_updated_email,
            args=(student.email, student.full_name, student.student_number, student),
            daemon=True,
        ).start()

    return _student_to_dict(student, db)


def restore_student(student_id: uuid.UUID, admin: User, ip: str, db: Session) -> dict:
    """Restore an archived student back to active status."""
    if admin.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators are allowed to restore student records.",
        )
    student = get_student_by_id(student_id, db)
    if not student.is_archived:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student is not archived.")

    student.is_archived = False
    student.archived_at = None
    student.archived_by = None
    db.commit()

    log_event(
        db,
        AuditAction.STUDENT_RESTORED,
        user_id=admin.id,
        ip_address=ip,
        detail=f"Student {student.student_number} restored from archive by {admin.email}.",
    )
    return {"message": f"Student {student.student_number} has been restored."}


def archive_student(student_id: uuid.UUID, admin: User, ip: str, db: Session) -> dict:
    """Soft-archive a student and deactivate their active QR tags."""
    if admin.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators are allowed to archive student records.",
        )
    student = get_student_by_id(student_id, db)
    if student.is_archived:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student is already archived.")

    now = datetime.now(PH_TZ)
    student.is_archived = True
    student.archived_at = now
    student.archived_by = admin.id

    active_tags = db.query(QRTag).filter(QRTag.student_id == student.id, QRTag.is_active == True).all()
    for tag in active_tags:
        tag.is_active = False
        tag.deactivated_at = now

    db.commit()

    if active_tags and student.email:
        threading.Thread(
            target=send_tag_deactivated_email,
            args=(student.email, student.full_name),
            daemon=True,
        ).start()

    log_event(
        db,
        AuditAction.STUDENT_ARCHIVED,
        user_id=admin.id,
        ip_address=ip,
        detail=f"Student {student.student_number} archived by {admin.email}.",
    )
    return {"message": f"Student {student.student_number} has been archived."}


def resend_invite(student_id: uuid.UUID, admin: User, ip: str, db: Session) -> dict:
    """Re-send (or create) an invite token and email for a student."""
    student = get_student_by_id(student_id, db)
    if student.is_archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send invite to an archived student.",
        )

    # Deactivate old tokens
    db.query(StudentToken).filter(
        StudentToken.student_id == student.id,
        StudentToken.is_active == True,
    ).update({"is_active": False})

    # Create new token
    raw_token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    st = StudentToken(student_id=student.id, token_hash=token_hash)
    db.add(st)
    db.commit()

    log_event(
        db,
        AuditAction.STUDENT_INVITED,
        user_id=admin.id,
        ip_address=ip,
        detail=f"Invite link re-sent to {student.email} for student {student.student_number}.",
    )

    from app.services.email_service import send_student_invite_email
    if student.email:
        threading.Thread(
            target=send_student_invite_email,
            kwargs=dict(
                to=student.email,
                full_name=student.full_name,
                student_number=student.student_number,
                token=raw_token,
            ),
            daemon=True,
        ).start()

    return {"message": f"Invite link sent to {student.email}."}


def start_new_semester(admin: User, ip: str, db: Session, deadline_days: int = 14) -> dict:
    """
    Trigger a new semester: set all active students to 'pending_continuation'
    and send continuation emails.
    """
    from app.services.email_service import send_semester_continuation_email
    from datetime import timedelta

    now = datetime.now(PH_TZ)
    deadline = now + timedelta(days=deadline_days)

    active_students = db.query(Student).filter(
        Student.is_archived == False,
        Student.enrollment_status != "pending_continuation",
    ).all()

    if not active_students:
        return {"message": "No active students to process.", "count": 0}

    count = 0
    for student in active_students:
        student.enrollment_status = "pending_continuation"
        student.enrollment_deadline = deadline

        # Get or create a token for the student
        active_token = db.query(StudentToken).filter(
            StudentToken.student_id == student.id,
            StudentToken.is_active == True,
        ).first()

        if active_token:
            # We can't recover the raw token from the hash, so generate a new one
            raw_token = secrets.token_urlsafe(48)
            token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
            active_token.is_active = False
            new_token = StudentToken(student_id=student.id, token_hash=token_hash)
            db.add(new_token)
        else:
            raw_token = secrets.token_urlsafe(48)
            token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
            new_token = StudentToken(student_id=student.id, token_hash=token_hash)
            db.add(new_token)

        if student.email:
            threading.Thread(
                target=send_semester_continuation_email,
                kwargs=dict(
                    to=student.email,
                    full_name=student.full_name,
                    student_number=student.student_number,
                    token=raw_token,
                    deadline=deadline.strftime("%B %d, %Y"),
                ),
                daemon=True,
            ).start()

        count += 1

    db.commit()

    log_event(
        db,
        AuditAction.SEMESTER_CONTINUATION_STARTED,
        user_id=admin.id,
        ip_address=ip,
        detail=f"New semester started by {admin.email}. {count} students set to pending_continuation. Deadline: {deadline.strftime('%Y-%m-%d')}.",
    )

    return {"message": f"New semester started. {count} students notified.", "count": count, "deadline": deadline.isoformat()}
