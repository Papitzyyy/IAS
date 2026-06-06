"""
get_otp.py — Helper utility to retrieve the latest active OTP code from the database.
Used for local testing when SMTP is not configured or email is not accessible.
"""
import hashlib
from app.db.database import SessionLocal
from app.db.models import OTPCode, User

def get_latest_otp():
    db = SessionLocal()
    try:
        latest = (
            db.query(OTPCode)
            .filter(OTPCode.is_used == False)
            .order_by(OTPCode.created_at.desc())
            .first()
        )
        if not latest:
            print("No active, unused OTP code found in the database.")
            return

        user = db.query(User).filter(User.id == latest.user_id).first()
        email = user.email if user else "Unknown User"
        
        # Brute force the 6-digit numeric OTP hash
        for i in range(1000000):
            code = f"{i:06d}"
            if hashlib.sha256(code.encode()).hexdigest() == latest.otp_hash:
                print(f"Latest active OTP for {email}: {code} (expires at {latest.expires_at})")
                return
        print(f"Could not decode OTP hash: {latest.otp_hash}")
    finally:
        db.close()

if __name__ == "__main__":
    get_latest_otp()
