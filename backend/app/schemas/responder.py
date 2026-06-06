from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator

from app.core.security import validate_password_strength


class ResponderCreate(BaseModel):
    email: EmailStr
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    password: str

    @field_validator("password")
    @classmethod
    def validate_pw(cls, v: str) -> str:
        errors = validate_password_strength(v)
        if errors:
            raise ValueError(errors[0])
        return v


class ResponderUpdate(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_pw(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        errors = validate_password_strength(v)
        if errors:
            raise ValueError(errors[0])
        return v


class ResponderProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    otp: Optional[str] = None  # Required when changing password


class ResponderResponse(BaseModel):
    id: str
    email: str
    first_name: str
    middle_name: Optional[str]
    last_name: str
    full_name: str
    is_active: bool
    is_verified: bool
    created_at: str
