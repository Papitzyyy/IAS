"""
services/audit_service.py
--------------------------
Centralized audit logging.
All writes go through log_event() to ensure consistent formatting.
The audit_logs table is protected at the DB level by a trigger —
no UPDATE or DELETE is possible from application code.
"""

import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.db.models import AuditAction, AuditLog


def log_event(
    db: Session,
    action: AuditAction,
    user_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    detail: Optional[str] = None,
) -> None:
    """
    Insert a single audit log entry.
    This is the only function that should write to audit_logs.
    """
    entry = AuditLog(
        action=action,
        user_id=user_id,
        ip_address=ip_address,
        detail=detail,
    )
    db.add(entry)
    db.commit()
