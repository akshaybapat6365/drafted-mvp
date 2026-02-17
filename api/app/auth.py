from __future__ import annotations

import datetime as dt

import jwt
from passlib.hash import pbkdf2_sha256

from .config import settings


def hash_password(password: str) -> str:
    return pbkdf2_sha256.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pbkdf2_sha256.verify(password, password_hash)
    except Exception:
        return False


def mint_access_token(*, user_id: str, email: str) -> str:
    now = dt.datetime.now(dt.UTC)
    payload = {
        "iss": settings.jwt_issuer,
        "sub": user_id,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(seconds=settings.jwt_ttl_seconds)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"], issuer=settings.jwt_issuer)
