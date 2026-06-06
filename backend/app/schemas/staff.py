import json
from typing import Optional, Dict, List
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.security import validate_password_strength


class StaffCreate(BaseModel):
    email: EmailStr
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    password: str = Field(..., min_length=12)
    permissions: Dict[str, List[str]] = Field(default_factory=dict, description="e.g. {'students': ['read', 'write']}")

    @field_validator("password")
    @classmethod
    def validate_pw_strength(cls, v: str) -> str:
        errors = validate_password_strength(v)
        if errors:
            raise ValueError(errors[0])
        return v

class StaffUpdate(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_pw_strength(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        errors = validate_password_strength(v)
        if errors:
            raise ValueError(errors[0])
        return v


class StaffPermissionsUpdate(BaseModel):
    permissions: Dict[str, List[str]]

class StaffResponse(BaseModel):
    id: str
    email: str
    first_name: str
    middle_name: Optional[str]
    last_name: str
    full_name: str
    role: str
    is_active: bool
    is_verified: bool
    created_at: str
    permissions: Dict[str, List[str]]
