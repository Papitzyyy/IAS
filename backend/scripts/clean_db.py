"""
clean_db.py
-----------
Deletes all database records (students, QR tags, OTP codes, audit logs, 
and non-admin users) while keeping the admin accounts intact.

Usage (from backend/):
    venv/Scripts/python scripts\\clean_db.py
"""

import os
import sys

# Ensure backend directory is in the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.db.models import User, Student, QRTag, OTPCode, AuditLog, UserRole

def clean_db():
    db = SessionLocal()
    try:
        print("\n=== CRCY Student Medical Tag System — Database Cleanup ===\n")
        
        # 1. Count existing data
        qr_count = db.query(QRTag).count()
        student_count = db.query(Student).count()
        otp_count = db.query(OTPCode).count()
        audit_count = db.query(AuditLog).count()
        non_admin_users = db.query(User).filter(User.role != UserRole.ADMIN).count()
        admin_users = db.query(User).filter(User.role == UserRole.ADMIN).count()
        
        print("Records before cleanup:")
        print(f"  QR Tags: {qr_count}")
        print(f"  Students: {student_count}")
        print(f"  OTP Codes: {otp_count}")
        print(f"  Audit Logs: {audit_count}")
        print(f"  Non-Admin Users (Staff/Responders): {non_admin_users}")
        print(f"  Admin Users (Preserved): {admin_users}")
        print("-" * 50)
        
        # 2. Delete data in dependency order
        print("1. Deleting QR Tags...")
        db.query(QRTag).delete(synchronize_session=False)
        
        print("2. Deleting Students...")
        db.query(Student).delete(synchronize_session=False)
        
        print("3. Deleting OTP Codes...")
        db.query(OTPCode).delete(synchronize_session=False)
        
        print("4. Deleting Audit Logs...")
        db.query(AuditLog).delete(synchronize_session=False)
        
        print("5. Deleting Non-Admin Users (Staff and Responders)...")
        db.query(User).filter(User.role != UserRole.ADMIN).delete(synchronize_session=False)
        
        db.commit()
        print("\n[SUCCESS] Cleanup completed successfully!")
        print("All records have been deleted except for the Admin account(s).")
        
    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] An error occurred during database cleanup: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    clean_db()
