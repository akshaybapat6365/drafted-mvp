from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...models import Session as SessionRow, User
from ...schemas import SessionCreateIn, SessionOut
from ..deps import get_current_user, get_db


router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionOut)
def create_session(payload: SessionCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = SessionRow(user_id=user.id, title=payload.title)
    db.add(s)
    db.commit()
    db.refresh(s)
    return SessionOut(id=s.id, title=s.title, status=s.status, created_at=s.created_at)


@router.get("", response_model=list[SessionOut])
def list_sessions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(SessionRow).filter(SessionRow.user_id == user.id).order_by(SessionRow.created_at.desc()).all()
    return [SessionOut(id=s.id, title=s.title, status=s.status, created_at=s.created_at) for s in rows]
