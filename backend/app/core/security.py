"""
security.py
-----------
All cryptographic utilities for the application.
- Password hashing (bcrypt)
- Password strength validation
- OTP generation and hashing (SHA-256)
- JWT creation and verification
- HMAC-SHA256 QR token signing and verification
- Deactivation link signing and verification
"""

import hashlib
import hmac
import random
import re
import string
from datetime import datetime, timedelta, timezone

from app.db.models import PH_TZ

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


# ---------------------------------------------------------------------------
# Password hashing (bcrypt)
# ---------------------------------------------------------------------------

def hash_password(plain_password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return bcrypt.hashpw(plain_password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def validate_password_strength(password: str) -> list[str]:
    """
    Validate password strength. Returns a list of error messages.
    An empty list means the password is acceptable.

    Requirements:
    - At least 12 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character (!@#$%^&*...)
    """
    errors = []
    if len(password) < 12:
        errors.append("Password must be at least 12 characters long.")
    if not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter.")
    if not re.search(r"\d", password):
        errors.append("Password must contain at least one number.")
    if not re.search(r'[!@#$%^&*()\-_=+\[\]{};:\'",.<>?/\\|`~]', password):
        errors.append("Password must contain at least one special character.")
    return errors


# ---------------------------------------------------------------------------
# OTP (SHA-256)
# ---------------------------------------------------------------------------

def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP of the given length."""
    return "".join(random.choices(string.digits, k=length))


def hash_otp(otp: str) -> str:
    """Hash an OTP using SHA-256 for short-lived storage."""
    return hashlib.sha256(otp.encode()).hexdigest()


def verify_otp(plain_otp: str, hashed_otp: str) -> bool:
    """Verify a plain OTP against its SHA-256 hash."""
    return hmac.compare_digest(hash_otp(plain_otp), hashed_otp)


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: timedelta) -> str:
    """Create a signed JWT with an expiry."""
    payload = data.copy()
    payload["exp"] = datetime.now(PH_TZ) + expires_delta
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    """
    Decode and verify a JWT.
    Raises JWTError if the token is invalid or expired.
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])


# ---------------------------------------------------------------------------
# HMAC-SHA256 QR token signing
# ---------------------------------------------------------------------------

def sign_qr_token(uuid: str) -> str:
    """
    Produce an HMAC-SHA256 signature for a QR token UUID.
    The QR code encodes: <uuid>.<signature>
    """
    return hmac.new(
        settings.QR_HMAC_SECRET.encode(),
        uuid.encode(),
        hashlib.sha256,
    ).hexdigest()


def verify_qr_token(uuid: str, signature: str) -> bool:
    """Verify the HMAC-SHA256 signature of a scanned QR token."""
    expected = sign_qr_token(uuid)
    return hmac.compare_digest(expected, signature)


def build_qr_payload(uuid: str) -> str:
    """Return the full QR payload string: <uuid>.<signature>"""
    return f"{uuid}.{sign_qr_token(uuid)}"


def parse_qr_payload(payload: str) -> tuple[str, str]:
    """
    Split a QR payload into (uuid, signature).
    Raises ValueError if the format is invalid.
    """
    parts = payload.split(".", 1)
    if len(parts) != 2:
        raise ValueError("Invalid QR payload format.")
    return parts[0], parts[1]


# ---------------------------------------------------------------------------
# Deactivation link signing (HMAC-SHA256)
# ---------------------------------------------------------------------------

def sign_deactivation_token(uuid: str) -> str:
    """Sign a deactivation token UUID for use in email links."""
    return hmac.new(
        settings.DEACTIVATION_HMAC_SECRET.encode(),
        uuid.encode(),
        hashlib.sha256,
    ).hexdigest()


def verify_deactivation_token(uuid: str, signature: str) -> bool:
    """Verify the signature on a deactivation link."""
    expected = sign_deactivation_token(uuid)
    return hmac.compare_digest(expected, signature)
