"""
models.py
---------
SQLAlchemy ORM models for all database tables.

Tables:
- users          : Admins and Responders (authenticated users)
- students       : Student data subjects (not system users)
- qr_tags        : QR tokens linked to student profiles
- otp_codes      : Short-lived OTP records for MFA
- audit_logs     : Append-only audit trail (protected by DB trigger)
"""

import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum as PyEnum

# Philippine Standard Time (UTC+8) — all timestamps stored in local time
PH_TZ = timezone(timedelta(hours=8))


def utcnow():
    return datetime.now(PH_TZ)


from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.database import Base
from app.db.encryption import EncryptedString, EncryptedText, DeterministicEncryptedString


# Use String for UUID — compatible with both SQLite (dev) and PostgreSQL (prod)
def uuid_col(primary_key=False, foreign_key=None):
    if foreign_key:
        return Column(String(36), ForeignKey(foreign_key), nullable=False)
    return Column(String(36), primary_key=primary_key,
                  default=lambda: str(uuid.uuid4()))


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, PyEnum):
    ADMIN = "admin"
    RESPONDER = "responder"
    STAFF = "staff"


class AuditAction(str, PyEnum):
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILURE = "login_failure"
    QR_SCAN = "qr_scan"
    QR_SCAN_INVALID = "qr_scan_invalid"
    TAG_CREATED = "tag_created"
    TAG_DEACTIVATED = "tag_deactivated"
    STUDENT_CREATED = "student_created"
    STUDENT_UPDATED = "student_updated"
    STUDENT_ARCHIVED = "student_archived"
    STUDENT_DELETED = "student_deleted"
    SESSION_REVOKED = "session_revoked"
    RESPONDER_CREATED = "responder_created"
    RESPONDER_UPDATED = "responder_updated"
    RESPONDER_RESTORED = "responder_restored"
    STAFF_CREATED = "staff_created"
    STAFF_UPDATED = "staff_updated"
    STAFF_ARCHIVED = "staff_archived"
    STAFF_RESTORED = "staff_restored"
    STAFF_DELETED = "staff_deleted"
    STUDENT_RESTORED = "student_restored"
    STUDENT_INVITED = "student_invited"
    STUDENT_SELF_UPDATED = "student_self_updated"
    SEMESTER_CONTINUATION_STARTED = "semester_continuation_started"
    STUDENT_CONTINUED = "student_continued"
    UNAUTHORIZED_REQUEST = "unauthorized_request"


# ---------------------------------------------------------------------------
# Users (Admins & Responders)
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id            = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email         = Column(DeterministicEncryptedString(), unique=True, nullable=False, index=True)
    first_name    = Column(EncryptedString(), nullable=False)
    middle_name   = Column(EncryptedString(), nullable=True)
    last_name     = Column(EncryptedString(), nullable=False)
    full_name     = Column(EncryptedString(), nullable=False)
    role          = Column(Enum(UserRole), nullable=False)
    password_hash = Column(String(255), nullable=False)
    permissions   = Column(Text, default="{}")  # JSON string of access control permissions
    is_active     = Column(Boolean, default=True, nullable=False)
    is_verified   = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String(255), nullable=True)
    failed_otp_attempts = Column(Integer, default=0, nullable=False)
    otp_locked_until    = Column(DateTime(timezone=True), nullable=True)
    created_at    = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at    = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    otp_codes = relationship("OTPCode", back_populates="user", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Students (Data Subjects — not system users)
# ---------------------------------------------------------------------------

class Student(Base):
    __tablename__ = "students"

    id             = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_number = Column(DeterministicEncryptedString(), unique=True, nullable=False, index=True)
    first_name     = Column(EncryptedString(), nullable=True)
    middle_name    = Column(EncryptedString(), nullable=True)
    last_name      = Column(EncryptedString(), nullable=True)
    suffix         = Column(EncryptedString(), nullable=True)
    full_name      = Column(EncryptedString(), nullable=False)
    email          = Column(DeterministicEncryptedString(), unique=True, nullable=False, index=True)
    program        = Column(String(100), nullable=True)
    gender         = Column(String(20), nullable=True)
    enrollment_status  = Column(String(30), default="active", nullable=False)
    enrollment_deadline = Column(DateTime(timezone=True), nullable=True)
    last_confirmed_at  = Column(DateTime(timezone=True), nullable=True)
    is_archived    = Column(Boolean, default=False, nullable=False)
    archived_at    = Column(DateTime(timezone=True), nullable=True)
    archived_by    = Column(String(36), ForeignKey("users.id"), nullable=True)
    age            = Column(Integer, nullable=True)
    address        = Column(EncryptedText, nullable=True)
    contact_number = Column(EncryptedString(), nullable=True)
    birthdate      = Column(EncryptedString(), nullable=True)
    place_of_birth = Column(EncryptedString(), nullable=True)

    # Parent/Guardian
    guardian_first_name    = Column(EncryptedString(), nullable=True)
    guardian_middle_name   = Column(EncryptedString(), nullable=True)
    guardian_last_name     = Column(EncryptedString(), nullable=True)
    guardian_contact       = Column(EncryptedString(), nullable=True)
    guardian_address       = Column(EncryptedText, nullable=True)

    # Medical history
    blood_type             = Column(EncryptedString(), nullable=True)
    hypertension           = Column(Boolean, default=False)
    hypertension_medication = Column(EncryptedString(), nullable=True)
    health_disease         = Column(Boolean, default=False)
    health_disease_diagnosis = Column(EncryptedString(), nullable=True)

    # COVID vaccination
    covid_vaccinated       = Column(Boolean, default=False)
    covid_dose1            = Column(EncryptedString(), nullable=True)
    covid_dose2            = Column(EncryptedString(), nullable=True)
    covid_booster          = Column(EncryptedString(), nullable=True)
    covid_vaccine_brand    = Column(EncryptedString(), nullable=True)

    # Allergies
    food_allergy           = Column(Boolean, default=False)
    food_allergy_specify   = Column(EncryptedString(), nullable=True)
    drug_allergy           = Column(Boolean, default=False)
    drug_allergy_specify   = Column(EncryptedString(), nullable=True)

    # Other conditions
    diabetes               = Column(Boolean, default=False)
    diabetes_medication    = Column(EncryptedString(), nullable=True)
    history_of_surgery     = Column(Boolean, default=False)
    surgery_procedure      = Column(EncryptedString(), nullable=True)
    mental_health          = Column(Boolean, default=False)
    mental_health_notes    = Column(EncryptedString(), nullable=True)

    created_by  = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at  = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at  = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    qr_tags = relationship("QRTag", back_populates="student", cascade="all, delete-orphan")
    tokens  = relationship("StudentToken", back_populates="student", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# QR Tags
# ---------------------------------------------------------------------------

class QRTag(Base):
    __tablename__ = "qr_tags"

    id             = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id     = Column(String(36), ForeignKey("students.id"), nullable=False)
    token_uuid     = Column(String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    is_active      = Column(Boolean, default=True, nullable=False)
    created_by     = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at     = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    deactivated_at = Column(DateTime(timezone=True), nullable=True)

    student = relationship("Student", back_populates="qr_tags")


# ---------------------------------------------------------------------------
# Student Tokens (secure portal access — no login required)
# ---------------------------------------------------------------------------

class StudentToken(Base):
    __tablename__ = "student_tokens"

    id         = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    token_hash = Column(String(64), unique=True, nullable=False)  # SHA-256 of raw token
    is_active  = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    student = relationship("Student", back_populates="tokens")


# ---------------------------------------------------------------------------
# OTP Codes (short-lived, SHA-256 hashed)
# ---------------------------------------------------------------------------

class OTPCode(Base):
    __tablename__ = "otp_codes"

    id         = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id    = Column(String(36), ForeignKey("users.id"), nullable=False)
    otp_hash   = Column(String(64), nullable=False)
    attempts   = Column(Integer, default=0, nullable=False)
    is_used    = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("User", back_populates="otp_codes")


# ---------------------------------------------------------------------------
# Audit Logs (append-only — protected by PostgreSQL trigger)
# ---------------------------------------------------------------------------

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id         = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    action     = Column(Enum(AuditAction), nullable=False)
    user_id    = Column(String(36), nullable=True)
    ip_address = Column(EncryptedString(), nullable=True)
    detail     = Column(EncryptedText, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


# ---------------------------------------------------------------------------
# Login Attempts (MFA Verification phase 1)
# ---------------------------------------------------------------------------

class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id             = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id        = Column(String(36), ForeignKey("users.id"), nullable=False)
    auth_token     = Column(String(64), unique=True, nullable=False)
    is_authorized  = Column(Boolean, default=False, nullable=False)
    expires_at     = Column(DateTime(timezone=True), nullable=False)
    created_at     = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("User")
