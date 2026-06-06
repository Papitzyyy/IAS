import re
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator, model_validator

from app.constants.programs import VALID_PROGRAM_CODES
from app.constants.validators import (
    build_full_name,
    is_evsu_email,
    normalize_email,
    normalize_ph_phone,
)


class StudentBase(BaseModel):
    student_number: str
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    suffix: Optional[str] = None
    email: EmailStr
    program: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    address: Optional[str] = None
    contact_number: Optional[str] = None
    birthdate: Optional[str] = None
    place_of_birth: Optional[str] = None
    guardian_first_name: Optional[str] = None
    guardian_middle_name: Optional[str] = None
    guardian_last_name: Optional[str] = None
    guardian_contact: Optional[str] = None
    guardian_address: Optional[str] = None
    blood_type: Optional[str] = None
    hypertension: Optional[bool] = False
    hypertension_medication: Optional[str] = None
    health_disease: Optional[bool] = False
    health_disease_diagnosis: Optional[str] = None
    covid_vaccinated: Optional[bool] = False
    covid_dose1: Optional[str] = None
    covid_dose2: Optional[str] = None
    covid_booster: Optional[str] = None
    covid_vaccine_brand: Optional[str] = None
    food_allergy: Optional[bool] = False
    food_allergy_specify: Optional[str] = None
    drug_allergy: Optional[bool] = False
    drug_allergy_specify: Optional[str] = None
    diabetes: Optional[bool] = False
    diabetes_medication: Optional[str] = None
    history_of_surgery: Optional[bool] = False
    surgery_procedure: Optional[str] = None
    mental_health: Optional[bool] = False
    mental_health_notes: Optional[str] = None
    generate_tag: Optional[bool] = False

    @field_validator("email")
    @classmethod
    def validate_evsu_email(cls, v: str) -> str:
        normalized = normalize_email(str(v))
        if not is_evsu_email(normalized):
            raise ValueError("Email must be a valid @evsu.edu.ph address.")
        return normalized

    @field_validator("program")
    @classmethod
    def validate_program(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        code = str(v).strip().upper()
        if code not in VALID_PROGRAM_CODES:
            raise ValueError(f"Invalid program code. Choose one of: {', '.join(sorted(VALID_PROGRAM_CODES))}.")
        return code

    @field_validator("contact_number", "guardian_contact")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        normalized = normalize_ph_phone(v)
        if not normalized:
            raise ValueError("Contact number must be a valid Philippine mobile (09XXXXXXXXX).")
        return normalized

    @field_validator("birthdate")
    @classmethod
    def validate_birthdate(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        if not re.match(r"^\d{1,2}/\d{1,2}/\d{4}$", str(v).strip()):
            raise ValueError("Birthdate must be in mm/dd/yyyy format.")
        return str(v).strip()

    @model_validator(mode="after")
    def validate_conditional_fields(self):
        pairs = [
            (self.hypertension, self.hypertension_medication, "hypertension medication"),
            (self.health_disease, self.health_disease_diagnosis, "health disease diagnosis"),
            (self.food_allergy, self.food_allergy_specify, "food allergy details"),
            (self.drug_allergy, self.drug_allergy_specify, "drug allergy details"),
            (self.diabetes, self.diabetes_medication, "diabetes medication"),
            (self.history_of_surgery, self.surgery_procedure, "surgery procedure"),
            (self.mental_health, self.mental_health_notes, "mental health notes"),
        ]
        for flag, detail, label in pairs:
            if flag and not (detail and str(detail).strip()):
                raise ValueError(f"Please provide {label} when answering Yes.")
        if self.covid_vaccinated and not any(
            [self.covid_dose1, self.covid_dose2, self.covid_booster, self.covid_vaccine_brand]
        ):
            raise ValueError("Please provide at least one COVID vaccination detail when answering Yes.")
        return self

    @property
    def computed_full_name(self) -> str:
        return build_full_name(self.first_name, self.last_name, self.middle_name, self.suffix)


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    student_number: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    suffix: Optional[str] = None
    email: Optional[EmailStr] = None
    program: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    address: Optional[str] = None
    contact_number: Optional[str] = None
    birthdate: Optional[str] = None
    place_of_birth: Optional[str] = None
    guardian_first_name: Optional[str] = None
    guardian_middle_name: Optional[str] = None
    guardian_last_name: Optional[str] = None
    guardian_contact: Optional[str] = None
    guardian_address: Optional[str] = None
    blood_type: Optional[str] = None
    hypertension: Optional[bool] = None
    hypertension_medication: Optional[str] = None
    health_disease: Optional[bool] = None
    health_disease_diagnosis: Optional[str] = None
    covid_vaccinated: Optional[bool] = None
    covid_dose1: Optional[str] = None
    covid_dose2: Optional[str] = None
    covid_booster: Optional[str] = None
    covid_vaccine_brand: Optional[str] = None
    food_allergy: Optional[bool] = None
    food_allergy_specify: Optional[str] = None
    drug_allergy: Optional[bool] = None
    drug_allergy_specify: Optional[str] = None
    diabetes: Optional[bool] = None
    diabetes_medication: Optional[str] = None
    history_of_surgery: Optional[bool] = None
    surgery_procedure: Optional[str] = None
    mental_health: Optional[bool] = None
    mental_health_notes: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_evsu_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        normalized = normalize_email(str(v))
        if not is_evsu_email(normalized):
            raise ValueError("Email must be a valid @evsu.edu.ph address.")
        return normalized

    @field_validator("program")
    @classmethod
    def validate_program(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return v
        code = str(v).strip().upper()
        if code not in VALID_PROGRAM_CODES:
            raise ValueError(f"Invalid program code.")
        return code

    @field_validator("contact_number", "guardian_contact")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return v
        normalized = normalize_ph_phone(v)
        if not normalized:
            raise ValueError("Contact number must be a valid Philippine mobile (09XXXXXXXXX).")
        return normalized


class StudentSelfUpdate(BaseModel):
    """Schema for student self-editing via the portal. Cannot change student_number or email."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    suffix: Optional[str] = None
    program: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    address: Optional[str] = None
    contact_number: Optional[str] = None
    birthdate: Optional[str] = None
    place_of_birth: Optional[str] = None
    guardian_first_name: Optional[str] = None
    guardian_middle_name: Optional[str] = None
    guardian_last_name: Optional[str] = None
    guardian_contact: Optional[str] = None
    guardian_address: Optional[str] = None
    blood_type: Optional[str] = None
    hypertension: Optional[bool] = None
    hypertension_medication: Optional[str] = None
    health_disease: Optional[bool] = None
    health_disease_diagnosis: Optional[str] = None
    covid_vaccinated: Optional[bool] = None
    covid_dose1: Optional[str] = None
    covid_dose2: Optional[str] = None
    covid_booster: Optional[str] = None
    covid_vaccine_brand: Optional[str] = None
    food_allergy: Optional[bool] = None
    food_allergy_specify: Optional[str] = None
    drug_allergy: Optional[bool] = None
    drug_allergy_specify: Optional[str] = None
    diabetes: Optional[bool] = None
    diabetes_medication: Optional[str] = None
    history_of_surgery: Optional[bool] = None
    surgery_procedure: Optional[str] = None
    mental_health: Optional[bool] = None
    mental_health_notes: Optional[str] = None

    @field_validator("program")
    @classmethod
    def validate_program(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return v
        code = str(v).strip().upper()
        if code not in VALID_PROGRAM_CODES:
            raise ValueError(f"Invalid program code.")
        return code

    @field_validator("contact_number", "guardian_contact")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return v
        normalized = normalize_ph_phone(v)
        if not normalized:
            raise ValueError("Contact number must be a valid Philippine mobile (09XXXXXXXXX).")
        return normalized


class StudentResponse(BaseModel):
    id: str
    student_number: str
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    suffix: Optional[str] = None
    full_name: str
    email: str
    program: Optional[str]
    gender: Optional[str]
    age: Optional[int]
    address: Optional[str]
    contact_number: Optional[str]
    birthdate: Optional[str]
    place_of_birth: Optional[str]
    guardian_first_name: Optional[str]
    guardian_middle_name: Optional[str]
    guardian_last_name: Optional[str]
    guardian_contact: Optional[str]
    guardian_address: Optional[str]
    blood_type: Optional[str]
    hypertension: Optional[bool]
    hypertension_medication: Optional[str]
    health_disease: Optional[bool]
    health_disease_diagnosis: Optional[str]
    covid_vaccinated: Optional[bool]
    covid_dose1: Optional[str]
    covid_dose2: Optional[str]
    covid_booster: Optional[str]
    covid_vaccine_brand: Optional[str]
    food_allergy: Optional[bool]
    food_allergy_specify: Optional[str]
    drug_allergy: Optional[bool]
    drug_allergy_specify: Optional[str]
    diabetes: Optional[bool]
    diabetes_medication: Optional[str]
    history_of_surgery: Optional[bool]
    surgery_procedure: Optional[str]
    mental_health: Optional[bool]
    mental_health_notes: Optional[str]
    is_archived: bool = False
    archived_at: Optional[str] = None
    has_active_tag: Optional[bool] = None
    enrollment_status: Optional[str] = "active"
    enrollment_deadline: Optional[str] = None
    last_confirmed_at: Optional[str] = None

    class Config:
        from_attributes = True
