"""
schemas/tag.py
--------------
Pydantic schemas for QR tag request and response payloads.
"""

from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class TagCreateRequest(BaseModel):
    student_id: UUID


class TagResponse(BaseModel):
    id: UUID
    student_id: UUID
    token_uuid: UUID
    qr_payload: str        # <uuid>.<hmac_signature> — encoded into the QR image
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ScanResponse(BaseModel):
    student_number: str
    full_name: str
    program: Optional[str] = None
    blood_type: Optional[str] = None
    food_allergy: Optional[bool] = None
    food_allergy_specify: Optional[str] = None
    drug_allergy: Optional[bool] = None
    drug_allergy_specify: Optional[str] = None
    hypertension: Optional[bool] = None
    hypertension_medication: Optional[str] = None
    diabetes: Optional[bool] = None
    diabetes_medication: Optional[str] = None
    history_of_surgery: Optional[bool] = None
    surgery_procedure: Optional[str] = None
    mental_health: Optional[bool] = None
    mental_health_notes: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_contact: Optional[str] = None
    # Mobile-friendly summaries (responder APK)
    allergies: Optional[str] = None
    medical_notes: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class DeactivateRequest(BaseModel):
    signature: str         # HMAC signature from the email deactivation link
