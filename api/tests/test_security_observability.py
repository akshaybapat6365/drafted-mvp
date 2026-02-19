from __future__ import annotations

import json

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import SessionLocal
from app.main import create_app
from app.models import UsageEvent


def _reset_runtime(tmp_path, monkeypatch, db_name: str):
    from app import config as cfg
    from app import db as db_mod

    monkeypatch.setattr(cfg.settings, "var_dir", tmp_path)
    monkeypatch.setattr(cfg.settings, "database_url", f"sqlite:///{tmp_path/db_name}")
    monkeypatch.setattr(cfg.settings, "run_inprocess_worker", False)
    monkeypatch.setattr(db_mod, "_engine", None)
    monkeypatch.setattr(db_mod, "_sessionmaker", None)


def _signup(client: TestClient, email: str) -> str:
    r = client.post("/api/v1/auth/signup", json={"email": email, "password": "password123"})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_unauthorized_and_cross_tenant_isolation(tmp_path, monkeypatch):
    _reset_runtime(tmp_path, monkeypatch, "security.db")
    app = create_app()
    with TestClient(app) as client:
        unauth = client.get("/api/v1/sessions")
        assert unauth.status_code == 401
        assert unauth.json()["error"]["code"] == "http_401"

        token1 = _signup(client, "owner@example.com")
        token2 = _signup(client, "other@example.com")
        h1 = {"authorization": f"Bearer {token1}"}
        h2 = {"authorization": f"Bearer {token2}"}

        r = client.post("/api/v1/sessions", json={"title": "Owner Session"}, headers=h1)
        assert r.status_code == 200
        session_id = r.json()["id"]

        r = client.post(
            f"/api/v1/jobs/sessions/{session_id}",
            json={
                "prompt": "3 bed 2 bath test home",
                "bedrooms": 3,
                "bathrooms": 2,
                "style": "contemporary",
                "want_exterior_image": False,
                "idempotency_key": "security-tenant-test",
            },
            headers=h1,
        )
        assert r.status_code == 200
        job_id = r.json()["id"]

        forbidden = client.get(f"/api/v1/jobs/{job_id}", headers=h2)
        assert forbidden.status_code == 404


def test_trace_correlation_and_frontend_event_ingestion(tmp_path, monkeypatch):
    _reset_runtime(tmp_path, monkeypatch, "observability.db")
    app = create_app()
    with TestClient(app) as client:
        trace_id = "trace-security-observability-001"
        health = client.get("/api/v1/system/health", headers={"x-trace-id": trace_id})
        assert health.status_code == 200
        assert health.headers.get("x-request-id") == trace_id

        token = _signup(client, "telemetry@example.com")
        event = client.post(
            "/api/v1/system/events",
            headers={
                "authorization": f"Bearer {token}",
                "x-trace-id": trace_id,
            },
            json={
                "event_name": "ui_click",
                "page": "/app",
                "status": "success",
                "metadata": {"target": "new-session"},
            },
        )
        assert event.status_code == 200
        assert event.json()["request_id"] == trace_id

        with SessionLocal() as db:
            row = db.execute(
                select(UsageEvent).where(UsageEvent.event_type == "web:ui_click")
            ).scalars().first()
            assert row is not None
            assert row.provider_request_id == trace_id
            meta = json.loads(row.meta_json)
            assert meta["page"] == "/app"
            assert meta["status"] == "success"
            assert meta["metadata"]["target"] == "new-session"
