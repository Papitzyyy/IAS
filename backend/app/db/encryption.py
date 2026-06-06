"""
encryption.py
-------------
SQLAlchemy custom types for Application-Level Encryption using Fernet and deterministic AES.
"""

import base64
import hashlib
from typing import Any, Optional

from sqlalchemy.types import TypeDecorator, String, Text
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding

from app.core.config import settings

# --- Fernet Setup for non-deterministic encryption ---
# The key must be 32 url-safe base64-encoded bytes.
_FERNET_KEY = settings.DB_ENCRYPTION_KEY.encode('utf-8')
if len(_FERNET_KEY) != 44:
    # If the key is not 44 chars (base64 of 32 bytes), hash it to derive a valid key
    _derived = hashlib.sha256(_FERNET_KEY).digest()
    _FERNET_KEY = base64.urlsafe_b64encode(_derived)

f = Fernet(_FERNET_KEY)

# --- Setup for Deterministic encryption ---
# We use AES-CBC with a fixed IV.
# A static IV allows identical strings to encrypt to identical ciphertexts, enabling equality lookup.

_AES_KEY = hashlib.sha256(settings.DB_ENCRYPTION_KEY.encode('utf-8')).digest()

def deterministic_encrypt(plaintext: str) -> str:
    if not plaintext:
        return plaintext
    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(plaintext.encode('utf-8')) + padder.finalize()
    # Fixed IV of 16 bytes for determinism
    iv = b'\x00' * 16
    cipher = Cipher(algorithms.AES(_AES_KEY), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(padded_data) + encryptor.finalize()
    return base64.b64encode(ciphertext).decode('utf-8')

def deterministic_decrypt(ciphertext_b64: str) -> str:
    if not ciphertext_b64:
        return ciphertext_b64
    try:
        ciphertext = base64.b64decode(ciphertext_b64.encode('utf-8'))
        iv = b'\x00' * 16
        cipher = Cipher(algorithms.AES(_AES_KEY), modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()
        padded_data = decryptor.update(ciphertext) + decryptor.finalize()
        unpadder = padding.PKCS7(128).unpadder()
        plaintext = unpadder.update(padded_data) + unpadder.finalize()
        return plaintext.decode('utf-8')
    except Exception:
        # Fallback to plain text in case it's not encrypted
        return ciphertext_b64

class EncryptedString(TypeDecorator):
    """
    Encrypts string data using Fernet. Non-deterministic.
    Cannot be used in WHERE clauses or ORDER BY.
    Always uses Text as the underlying DB type because ciphertext is always
    much longer than the original plaintext.
    """
    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Optional[str], dialect: Any) -> Optional[str]:
        if value is None:
            return None
        return f.encrypt(value.encode('utf-8')).decode('utf-8')

    def process_result_value(self, value: Optional[str], dialect: Any) -> Optional[str]:
        if value is None:
            return None
        try:
            return f.decrypt(value.encode('utf-8')).decode('utf-8')
        except Exception:
            return value

class EncryptedText(EncryptedString):
    """Alias kept for backwards compatibility — identical to EncryptedString now."""
    impl = Text

class DeterministicEncryptedString(TypeDecorator):
    """
    Encrypts string data deterministically using AES-CBC with a fixed IV.
    Can be used in exact-match WHERE clauses (e.g., filter(User.email == email)).
    Always uses Text as the underlying DB type because ciphertext is longer than plaintext.
    """
    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Optional[str], dialect: Any) -> Optional[str]:
        if value is None:
            return None
        return deterministic_encrypt(value)

    def process_result_value(self, value: Optional[str], dialect: Any) -> Optional[str]:
        if value is None:
            return None
        return deterministic_decrypt(value)
