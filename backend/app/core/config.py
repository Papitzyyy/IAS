from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    PUBLIC_BASE_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5500"
    SECRET_KEY: str
    QR_HMAC_SECRET: str
    DEACTIVATION_HMAC_SECRET: str
    DB_ENCRYPTION_KEY: str

    # Database
    DATABASE_URL: str                      # PostgreSQL connection string

    # JWT
    ACCESS_TOKEN_EXPIRE_MINUTES_ADMIN: int = 480       # 8 hours
    ACCESS_TOKEN_EXPIRE_MINUTES_RESPONDER: int = 43200  # 30 days

    # OTP
    OTP_EXPIRE_MINUTES: int = 15
    OTP_MAX_ATTEMPTS: int = 3

    # Email (Brevo SMTP via Port 2525)
    BREVO_SMTP_LOGIN: str
    BREVO_SMTP_PASSWORD: str
    EMAIL_FROM: str

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    # Seed passwords (used by seed.py — not loaded at runtime normally)
    SEED_ADMIN_PASSWORD: str = ""
    SEED_RESPONDER_PASSWORD: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
