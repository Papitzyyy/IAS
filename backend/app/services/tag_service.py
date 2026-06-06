"""
services/tag_service.py
-----------------------
Business logic for QR tag lifecycle.
- List all tags
- Create a signed QR tag for a student
- Scan and validate a QR token
- Deactivate a tag (admin or student via email link)
"""

import threading
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import PH_TZ

from app.core.security import (
    build_qr_payload,
    parse_qr_payload,
    sign_deactivation_token,
    verify_deactivation_token,
    verify_qr_token,
)
from app.db.models import AuditAction, QRTag, Student, User
from app.services.audit_service import log_event
from app.services.email_service import send_tag_created_email, send_tag_deactivated_email
from app.utils.scan_helpers import build_scan_response


def create_tag(student_id: uuid.UUID, admin: User, db: Session) -> dict:
    """
    Generate a new signed QR tag for a student.
    Sends a notification email to the student upon creation.
    """
    student = db.query(Student).filter(Student.id == str(student_id)).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

    existing = db.query(QRTag).filter(
        QRTag.student_id == str(student_id),
        QRTag.is_active == True,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This student already has an active QR tag. Deactivate it before generating a new one.",
        )

    token_uuid = str(uuid.uuid4())
    qr_payload = build_qr_payload(token_uuid)
    deactivation_sig = sign_deactivation_token(token_uuid)

    tag = QRTag(
        student_id=str(student_id),
        token_uuid=token_uuid,
        created_by=str(admin.id),
    )
    db.add(tag)
    db.commit()
    db.refresh(tag)

    log_event(db, AuditAction.TAG_CREATED, user_id=str(admin.id),
              detail=f"Tag {token_uuid} created for student {student.student_number}.")

    try:
        send_tag_created_email(
            to=student.email,
            full_name=student.full_name,
            student_number=student.student_number,
            food_allergy=student.food_allergy,
            food_allergy_specify=student.food_allergy_specify,
            drug_allergy=student.drug_allergy,
            drug_allergy_specify=student.drug_allergy_specify,
            token_uuid=str(token_uuid),
            qr_payload=qr_payload,
            deactivation_signature=deactivation_sig,
            blood_type=student.blood_type,
            guardian_name=" ".join(filter(None, [getattr(student, 'guardian_first_name', None), getattr(student, 'guardian_middle_name', None), getattr(student, 'guardian_last_name', None)])) or None,
            guardian_contact=student.guardian_contact,
            hypertension=student.hypertension,
            hypertension_medication=student.hypertension_medication,
            diabetes=student.diabetes,
            diabetes_medication=student.diabetes_medication,
            health_disease=student.health_disease,
            health_disease_diagnosis=student.health_disease_diagnosis,
            history_of_surgery=student.history_of_surgery,
            surgery_procedure=student.surgery_procedure,
            mental_health=student.mental_health,
            mental_health_notes=student.mental_health_notes,
            covid_vaccinated=student.covid_vaccinated,
            covid_vaccine_brand=student.covid_vaccine_brand,
            covid_booster=student.covid_booster,
        )
    except Exception as exc:
        import traceback
        traceback.print_exc()
        print(f"[TAG EMAIL ERROR] Failed to send tag email for {student.student_number}: {type(exc).__name__}: {exc}")
        db.delete(tag)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"QR tag could not be issued because the notification email failed to send. Error: {type(exc).__name__}: {exc}",
        )

    return {
        "id": tag.id,
        "student_id": tag.student_id,
        "token_uuid": tag.token_uuid,
        "qr_payload": qr_payload,
        "is_active": tag.is_active,
        "created_at": tag.created_at,
    }


def scan_tag(qr_payload: str, responder: User, ip: str, db: Session) -> dict:
    """
    Validate a scanned QR payload and return the student's medical data.
    Logs every scan attempt regardless of outcome.
    """
    try:
        token_uuid_str, signature = parse_qr_payload(qr_payload)
    except ValueError:
        log_event(db, AuditAction.QR_SCAN_INVALID, user_id=responder.id, ip_address=ip,
                  detail="Malformed QR payload.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid QR code format.")

    if not verify_qr_token(token_uuid_str, signature):
        log_event(db, AuditAction.QR_SCAN_INVALID, user_id=responder.id, ip_address=ip,
                  detail=f"Invalid HMAC signature for token {token_uuid_str}.")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="QR code signature is invalid.")

    tag = db.query(QRTag).filter(
        QRTag.token_uuid == token_uuid_str,
        QRTag.is_active == True,
    ).first()

    if not tag:
        log_event(db, AuditAction.QR_SCAN_INVALID, user_id=responder.id, ip_address=ip,
                  detail=f"Token {token_uuid_str} not found or deactivated.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR tag not found or deactivated.")

    student = db.query(Student).filter(Student.id == tag.student_id).first()

    log_event(db, AuditAction.QR_SCAN, user_id=responder.id, ip_address=ip,
              detail=f"Successful scan of token {token_uuid_str} for student {student.student_number}.")

    return build_scan_response(student)


def search_students_for_responder(query: str, responder: User, ip: str, db: Session) -> list:
    """Search active students by student_number or full_name for manual lookup."""
    query = query.strip().lower()
    if not query:
        return []
        
    # Since student data is encrypted at rest (EncryptedString), we cannot use SQL `ilike()`.
    # We must load active students and filter them in memory.
    active_students = db.query(Student).filter(Student.is_archived == False).all()
    
    matches = []
    from app.constants.validators import build_full_name
    
    for s in active_students:
        s_num = (s.student_number or "").lower()
        f_name = (s.first_name or "").lower()
        l_name = (s.last_name or "").lower()
        
        if query in s_num or query in f_name or query in l_name:
            matches.append({
                "id": str(s.id),
                "student_number": s.student_number,
                "full_name": build_full_name(s.first_name, s.last_name, s.middle_name),
                "program": s.program,
            })
            if len(matches) >= 20:
                break
                
    log_event(db, AuditAction.QR_SCAN, user_id=responder.id, ip_address=ip,
              detail=f"Responder searched for students matching '{query}'.")
              
    return matches


def get_student_profile_for_responder(student_number: str, responder: User, ip: str, db: Session) -> dict:
    """Load profile by student_number (manual lookup)."""
    student = db.query(Student).filter(
        Student.student_number == student_number,
        Student.is_archived == False,
    ).first()
    
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found or archived.")
        
    log_event(db, AuditAction.QR_SCAN, user_id=responder.id, ip_address=ip,
              detail=f"Responder manually viewed profile of student {student.student_number}.")
              
    return build_scan_response(student)


def _notify_tag_deactivated(db: Session, tag: QRTag) -> None:
    """Email student when their tag is deactivated (RA 10173 notification)."""
    student = db.query(Student).filter(Student.id == tag.student_id).first()
    if student and student.email:
        threading.Thread(
            target=send_tag_deactivated_email,
            args=(student.email, student.full_name),
            daemon=True,
        ).start()


def deactivate_tag_by_student(token_uuid_str: str, signature: str, ip: str, db: Session) -> dict:
    """
    Deactivate a tag via the student's email deactivation link.
    Verifies the HMAC signature before deactivating.
    """
    if not verify_deactivation_token(token_uuid_str, signature):
        log_event(db, AuditAction.UNAUTHORIZED_REQUEST, ip_address=ip,
                  detail=f"Invalid deactivation signature for token {token_uuid_str}.")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid deactivation link.")

    tag = db.query(QRTag).filter(
        QRTag.token_uuid == token_uuid_str,
        QRTag.is_active == True,
    ).first()

    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found or already deactivated.")

    tag.is_active = False
    tag.deactivated_at = datetime.now(PH_TZ)
    db.commit()

    log_event(db, AuditAction.TAG_DEACTIVATED, ip_address=ip,
              detail=f"Tag {token_uuid_str} deactivated via student email link.")

    _notify_tag_deactivated(db, tag)

    return {"message": "Your medical tag has been deactivated successfully."}


def deactivate_tag_by_admin(tag_id: uuid.UUID, admin: User, ip: str, db: Session) -> dict:
    """
    Deactivate a tag by an Admin (e.g., student reported lost tag).
    """
    tag = db.query(QRTag).filter(QRTag.id == str(tag_id), QRTag.is_active == True).first()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found or already deactivated.")

    tag.is_active = False
    tag.deactivated_at = datetime.now(PH_TZ)
    db.commit()

    log_event(db, AuditAction.TAG_DEACTIVATED, user_id=admin.id, ip_address=ip,
              detail=f"Tag {tag.token_uuid} deactivated by admin {admin.email}.")

    _notify_tag_deactivated(db, tag)

    return {"message": "Tag deactivated successfully."}


def list_tags(db: Session) -> list[dict]:
    """Return all QR tags with their associated student info."""
    tags = db.query(QRTag).order_by(QRTag.created_at.desc()).all()
    result = []
    for tag in tags:
        student = db.query(Student).filter(Student.id == tag.student_id).first()
        result.append({
            "id": str(tag.id),
            "token_uuid": str(tag.token_uuid),
            "is_active": tag.is_active,
            "created_at": tag.created_at.isoformat(),
            "deactivated_at": tag.deactivated_at.isoformat() if tag.deactivated_at else None,
            "student_id": str(tag.student_id),
            "student_name": student.full_name if student else "Unknown",
            "student_number": student.student_number if student else "—",
            "student_program": student.program if student else None,
        })
    return result
