from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...auth import hash_password, mint_access_token, verify_password
from ...models import User
from ...schemas import AuthLoginIn, AuthSignupIn, AuthTokenOut, MeOut
from ..deps import get_current_user, get_db


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthTokenOut)
def signup(payload: AuthSignupIn, response: Response, db: Session = Depends(get_db)):
    existing = db.execute(select(User).where(User.email == payload.email)).scalars().first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = mint_access_token(user_id=user.id, email=user.email)
    response.set_cookie("drafted_token", token, httponly=True, samesite="lax", secure=False)
    return AuthTokenOut(access_token=token)


@router.post("/login", response_model=AuthTokenOut)
def login(payload: AuthLoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == payload.email)).scalars().first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = mint_access_token(user_id=user.id, email=user.email)
    response.set_cookie("drafted_token", token, httponly=True, samesite="lax", secure=False)
    return AuthTokenOut(access_token=token)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("drafted_token")
    return {"ok": True}


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)):
    return MeOut(id=user.id, email=user.email, plan_tier=user.plan_tier, credits=user.credits)
