from __future__ import annotations

import datetime as dt
import json
import shutil
from pathlib import Path
from urllib.parse import urlsplit

import redis
from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from ...auth import decode_token
from ...config import settings
from ...db import get_engine
from ...logging import get_request_id, log_event
from ...models import Job, UsageEvent, User
from ...schemas import FrontendEventIn
from ..deps import get_db


router = APIRouter(prefix="/system", tags=["system"])


def _optional_user_id(request: Request, db: Session) -> str | None:
    auth = request.headers.get("authorization") or ""
    token = None
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
    if not token:
        token = request.cookies.get("drafted_token")
    if not token:
        return None
    try:
        payload = decode_token(token)
    except Exception:
        return None
    user = db.get(User, payload.get("sub"))
    return user.id if user else None


def _read_worker_heartbeat() -> dict:
    p = settings.var_dir / "worker_heartbeat.json"
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _heartbeat_age_seconds(heartbeat: dict) -> int | None:
    ts = heartbeat.get("timestamp")
    if not isinstance(ts, str):
        return None
    try:
        stamp = dt.datetime.fromisoformat(ts)
    except ValueError:
        return None
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=dt.UTC)
    return max(0, int((dt.datetime.now(dt.UTC) - stamp).total_seconds()))


def _redis_status() -> dict:
    if not settings.redis_url:
        return {"status": "not_configured"}
    host = urlsplit(settings.redis_url).hostname or "unknown"
    try:
        client = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=1, socket_timeout=1)
        client.ping()
        return {"status": "ok", "host": host}
    except Exception as exc:
        return {"status": "error", "host": host, "error": str(exc)[:200]}


@router.get("/health")
def system_health(db: Session = Depends(get_db)):
    cutoff = dt.datetime.now(dt.UTC) - dt.timedelta(hours=24)
    database_status = "ok"
    database_error: str | None = None
    queued = 0
    running = 0
    failed_24h = 0
    succeeded_24h = 0
    try:
        db.execute(text("SELECT 1"))
        queued = db.query(Job).filter(Job.status == "queued").count()
        running = db.query(Job).filter(Job.status == "running").count()
        failed_24h = db.query(Job).filter(Job.status == "failed", Job.updated_at >= cutoff).count()
        succeeded_24h = db.query(Job).filter(Job.status == "succeeded", Job.updated_at >= cutoff).count()
    except Exception as exc:
        database_status = "error"
        database_error = str(exc)[:200]

    disk_total = 0
    disk_used = 0
    disk_free = 0
    try:
        settings.var_dir.mkdir(parents=True, exist_ok=True)
        disk = shutil.disk_usage(settings.var_dir)
        disk_total = disk.total
        disk_used = disk.used
        disk_free = disk.free
    except Exception:
        pass

    heartbeat = _read_worker_heartbeat()
    heartbeat_age = _heartbeat_age_seconds(heartbeat)
    worker_stale = heartbeat_age is None or heartbeat_age > settings.worker_heartbeat_ttl_seconds
    redis_status = _redis_status()

    ok = database_status == "ok" and redis_status["status"] in {"ok", "not_configured"}

    return {
        "ok": ok,
        "provider_mode": "gemini" if settings.gemini_api_key else "mock",
        "database": {
            "status": database_status,
            "backend": get_engine().url.get_backend_name(),
            "migration_version": "create_all",
            "error": database_error,
        },
        "var_dir": str(settings.var_dir),
        "disk_total_bytes": disk_total,
        "disk_used_bytes": disk_used,
        "disk_free_bytes": disk_free,
        "queue": {
            "queued": queued,
            "running": running,
            "failed_last_24h": failed_24h,
            "succeeded_last_24h": succeeded_24h,
        },
        "queue_backend": {
            "kind": "db_polling",
            "status": "ok" if database_status == "ok" else "error",
        },
        "worker": {
            "heartbeat": heartbeat,
            "heartbeat_age_seconds": heartbeat_age,
            "stale": worker_stale,
            "heartbeat_ttl_seconds": settings.worker_heartbeat_ttl_seconds,
        },
        "redis": redis_status,
    }


@router.post("/events")
def ingest_frontend_event(
    payload: FrontendEventIn,
    request: Request,
    db: Session = Depends(get_db),
):
    user_id = _optional_user_id(request, db)
    meta = payload.metadata or {}
    req_id = request.headers.get("x-request-id") or request.headers.get("x-trace-id") or get_request_id()
    db.add(
        UsageEvent(
            user_id=user_id,
            job_id=None,
            event_type=f"web:{payload.event_name}",
            provider_model=None,
            input_tokens=None,
            output_tokens=None,
            image_tokens=None,
            latency_ms=None,
            provider_request_id=req_id,
            retryable=0,
            meta_json=json.dumps(
                {
                    "page": payload.page,
                    "status": payload.status,
                    "metadata": meta,
                    "at": (payload.at or dt.datetime.now(dt.UTC)).isoformat(),
                }
            ),
        )
    )
    db.commit()
    log_event(
        "api",
        "frontend_event",
        event_name=payload.event_name,
        page=payload.page,
        status=payload.status,
        user_id=user_id,
    )
    return {"ok": True, "request_id": req_id}
