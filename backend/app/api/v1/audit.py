"""
api/v1/audit.py
---------------
Audit log viewer endpoint. Admin only.

GET /api/v1/audit — Return paginated audit log entries
"""

from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, PermissionChecker
from app.db.models import AuditLog, User

router = APIRouter()


@router.get("")
def get_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None, description="Filter by action type"),
    date_filter: Optional[date] = Query(None, alias="date", description="Filter by date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    admin: User = Depends(PermissionChecker("audit", "read")),
):
    """Return paginated audit log entries. Admin only. Read-only."""
    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())

    if action:
        query = query.filter(AuditLog.action == action)

    if date_filter:
        # Filter to the full UTC day
        day_start = datetime(date_filter.year, date_filter.month, date_filter.day, 0, 0, 0, tzinfo=timezone.utc)
        day_end   = datetime(date_filter.year, date_filter.month, date_filter.day, 23, 59, 59, 999999, tzinfo=timezone.utc)
        query = query.filter(AuditLog.created_at >= day_start, AuditLog.created_at <= day_end)

    total = query.count()
    logs = query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "results": [
            {
                "id": str(log.id),
                "action": log.action,
                "user_id": str(log.user_id) if log.user_id else None,
                "ip_address": log.ip_address,
                "detail": log.detail,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ],
    }
