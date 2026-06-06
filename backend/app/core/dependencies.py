"""
dependencies.py
---------------
FastAPI dependency injection functions.
Used to enforce authentication and role-based access control on routes.
"""

import json

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.database import get_db
from app.db.models import AuditAction, User, UserRole

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Decode the JWT from the Authorization header and return the active user.
    Raises 401 if the token is missing, invalid, or expired.
    Raises 403 if the user account is inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None:
        raise credentials_exception
    return user


def require_admin(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Restrict endpoint access to Admin role only. Logs denied attempts."""
    if current_user.role != UserRole.ADMIN:
        from app.services.audit_service import log_event
        log_event(
            db,
            AuditAction.UNAUTHORIZED_REQUEST,
            user_id=current_user.id,
            ip_address=request.client.host,
            detail=f"Non-admin user {current_user.email} ({current_user.role}) attempted admin-only access to {request.url.path}.",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


def require_responder(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Restrict endpoint access to Responder role only. Logs denied attempts."""
    if current_user.role != UserRole.RESPONDER:
        from app.services.audit_service import log_event
        log_event(
            db,
            AuditAction.UNAUTHORIZED_REQUEST,
            user_id=current_user.id,
            ip_address=request.client.host,
            detail=f"Non-responder user {current_user.email} ({current_user.role}) attempted responder-only access to {request.url.path}.",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Responder access required.",
        )
    return current_user


class PermissionChecker:
    """Dependency class to check module-level permissions for STAFF. Admins bypass."""
    def __init__(self, module: str, action: str):
        self.module = module
        self.action = action

    def __call__(
        self,
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if current_user.role == UserRole.ADMIN:
            return current_user

        if current_user.role == UserRole.STAFF:
            try:
                perms = json.loads(current_user.permissions or "{}")
            except json.JSONDecodeError:
                perms = {}

            module_perms = perms.get(self.module, [])
            if self.action in module_perms:
                return current_user

        from app.services.audit_service import log_event
        log_event(
            db,
            AuditAction.UNAUTHORIZED_REQUEST,
            user_id=current_user.id,
            ip_address=request.client.host,
            detail=f"User {current_user.email} ({current_user.role}) denied {self.action} access to module '{self.module}' at {request.url.path}.",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have {self.action} access to the {self.module} module.",
        )
