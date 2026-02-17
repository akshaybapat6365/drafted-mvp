from __future__ import annotations

import datetime as dt
import json
import shutil
from pathlib import Path
from urllib.parse import urlsplit

import redis
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ...config import settings
from ...db import get_engine
from ...models import Job
from ..deps import get_db


router = APIRouter(prefix="/system", tags=["system"])


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
    queued = db.query(Job).filter(Job.status == "queued").count()
    running = db.query(Job).filter(Job.status == "running").count()
    failed_24h = db.query(Job).filter(Job.status == "failed", Job.updated_at >= cutoff).count()
    succeeded_24h = db.query(Job).filter(Job.status == "succeeded", Job.updated_at >= cutoff).count()
    disk = shutil.disk_usage(settings.var_dir)

    database_status = "ok"
    database_error: str | None = None
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        database_status = "error"
        database_error = str(exc)[:200]

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
        "disk_total_bytes": disk.total,
        "disk_used_bytes": disk.used,
        "disk_free_bytes": disk.free,
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
