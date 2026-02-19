from __future__ import annotations

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


def _connect_args_for(url: str) -> dict:
    # Needed for sqlite multithreading in dev.
    if url.startswith("sqlite:///"):
        return {"check_same_thread": False}
    return {}


_engine: Engine | None = None
_sessionmaker: sessionmaker | None = None


def get_engine() -> Engine:
    global _engine, _sessionmaker
    if _engine is None:
        url = settings.resolved_database_url()
        _engine = create_engine(url, connect_args=_connect_args_for(url))
        _sessionmaker = sessionmaker(bind=_engine, autoflush=False, autocommit=False)
    return _engine


def SessionLocal() -> Session:
    # Keep the call-sites simple: `with SessionLocal() as db: ...`
    global _sessionmaker
    if _sessionmaker is None:
        get_engine()
    assert _sessionmaker is not None
    return _sessionmaker()


def init_db() -> None:
    from . import models as _models  # noqa: F401

    settings.var_dir.mkdir(parents=True, exist_ok=True)
    eng = get_engine()
    Base.metadata.create_all(bind=eng)

    # Minimal dev-friendly migrations for sqlite (create_all doesn't ALTER tables).
    if eng.url.get_backend_name() == "sqlite":
        def _ensure_columns(table: str, defs: dict[str, str], conn) -> bool:
            cols = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            names = {c[1] for c in cols}
            changed = False
            for col, ddl in defs.items():
                if col not in names:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}"))
                    changed = True
            return changed

        with eng.connect() as conn:
            changed = False
            changed |= _ensure_columns(
                "jobs",
                {
                    "parent_job_id": "VARCHAR(36)",
                    "want_exterior_image": "INTEGER NOT NULL DEFAULT 1",
                    "idempotency_key": "VARCHAR(80)",
                    "request_hash": "VARCHAR(64)",
                    "priority": "VARCHAR(16) NOT NULL DEFAULT 'normal'",
                    "failure_code": "VARCHAR(64)",
                    "retry_count": "INTEGER NOT NULL DEFAULT 0",
                    "provider_meta_json": "TEXT NOT NULL DEFAULT '{}'",
                    "stage_timestamps_json": "TEXT NOT NULL DEFAULT '{}'",
                    "warnings_json": "TEXT NOT NULL DEFAULT '[]'",
                },
                conn,
            )
            changed |= _ensure_columns(
                "artifacts",
                {
                    "checksum_sha256": "VARCHAR(64)",
                    "size_bytes": "INTEGER",
                },
                conn,
            )
            if changed:
                conn.commit()
