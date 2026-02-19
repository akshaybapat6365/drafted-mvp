from __future__ import annotations

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..auth import decode_token
from ..db import SessionLocal
from ..models import User


def get_db():
    try:
        db = SessionLocal()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "database_unavailable",
                "message": "Database connection is unavailable",
                "details": {"reason": str(exc)[:200]},
                "retryable": True,
            },
        )
    try:
        yield db
    finally:
        db.close()


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth = request.headers.get("authorization")
    token = None
    if auth and auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
    if not token:
        token = request.cookies.get("drafted_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.get(User, payload.get("sub"))
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    return user
