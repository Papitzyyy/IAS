"""
seed.py
-------
Populates the database with the default Admin user account.

Usage (from backend/):
    venv/Scripts/python scripts/seed.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal, engine
from app.db.models import Base, User, UserRole
from app.core.security import hash_password
from app.constants.validators import build_full_name

ADMIN = {
    "email": "ianbristan2005@gmail.com",
    "first_name": "CRCY",
    "middle_name": "Clinic",
    "last_name": "Admin",
    "role": UserRole.ADMIN,
    "password": "!@#$%_12345_abcdE",
}

def seed():
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("\n=== CRCY Scan and Help — Database Seed ===\n")

        # Create or update Admin
        existing = db.query(User).filter(User.email == ADMIN["email"]).first()
        if existing:
            existing.password_hash = hash_password(ADMIN["password"])
            existing.first_name = ADMIN["first_name"]
            existing.middle_name = ADMIN.get("middle_name")
            existing.last_name = ADMIN["last_name"]
            existing.full_name = build_full_name(ADMIN["first_name"], ADMIN["last_name"], ADMIN.get("middle_name"))
            existing.role = UserRole.ADMIN
            existing.failed_otp_attempts = 0
            existing.otp_locked_until = None
            existing.is_verified = True
            db.commit()
            print(f"  [updated] ADMIN     {ADMIN['email']}")
        else:
            admin = User(
                email=ADMIN["email"],
                first_name=ADMIN["first_name"],
                middle_name=ADMIN.get("middle_name"),
                last_name=ADMIN["last_name"],
                full_name=build_full_name(ADMIN["first_name"], ADMIN["last_name"], ADMIN.get("middle_name")),
                role=UserRole.ADMIN,
                password_hash=hash_password(ADMIN["password"]),
                is_verified=True,
            )
            db.add(admin)
            db.commit()
            print(f"  [created] ADMIN     {ADMIN['email']}")

        print("\n=== Seed complete ===")
        print(f"  Admin Email: {ADMIN['email']}")
        print(f"  Password:    {ADMIN['password']}")

    finally:
        db.close()

if __name__ == "__main__":
    seed()
