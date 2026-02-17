from __future__ import annotations

import time

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import create_app
from app.models import Job
from app.db import SessionLocal
from app.providers.base import ProviderMeta, ProviderSpecResult
from app.schemas import HouseSpec, HouseSpecRoom


def _drain_worker_once() -> bool:
    from app.jobs import worker as worker_mod
    from app import config as cfg

    with SessionLocal() as db:
        job = worker_mod._claim_next_job(db)
        if not job:
            return False
        try:
            worker_mod.process_job(db, job)
        except Exception as e:
            code, retryable = worker_mod._classify_failure(e)
            job.failure_code = code
            job.error = str(e)[:4000]
            if retryable and job.retry_count < cfg.settings.job_max_retries:
                job.retry_count += 1
                job.status = "queued"
                worker_mod._set_stage(job, "retry_wait")
            else:
                job.status = "failed"
                worker_mod._set_stage(job, "done")
            db.commit()
        return True


def _wait_for_terminal(client: TestClient, job_id: str, tries: int = 100) -> dict:
    for _ in range(tries):
        _drain_worker_once()
        r = client.get(f"/api/v1/jobs/{job_id}")
        assert r.status_code == 200
        data = r.json()
        if data["status"] in {"succeeded", "failed"}:
            return data
        time.sleep(0.1)
    raise AssertionError("job did not reach terminal state")


def _make_spec(*, bedrooms: int, bathrooms: int, style: str) -> HouseSpec:
    rooms = [
        HouseSpecRoom(id="living", type="living", name="Living Room", area_ft2=260),
        HouseSpecRoom(id="kitchen", type="kitchen", name="Kitchen", area_ft2=180),
        HouseSpecRoom(id="dining", type="dining", name="Dining", area_ft2=140),
    ]
    for i in range(bedrooms):
        rooms.append(
            HouseSpecRoom(
                id=f"bedroom-{i + 1}",
                type="bedroom",
                name=f"Bedroom {i + 1}",
                area_ft2=130,
            )
        )
    for i in range(bathrooms):
        rooms.append(
            HouseSpecRoom(
                id=f"bathroom-{i + 1}",
                type="bathroom",
                name=f"Bathroom {i + 1}",
                area_ft2=60,
            )
        )
    return HouseSpec(style=style, bedrooms=bedrooms, bathrooms=bathrooms, rooms=rooms, notes=[])


def test_transient_provider_failure_retries_then_succeeds(tmp_path, monkeypatch):
    from app import config as cfg
    from app import db as db_mod
    from app.jobs import worker as worker_mod

    monkeypatch.setattr(cfg.settings, "var_dir", tmp_path)
    monkeypatch.setattr(cfg.settings, "database_url", f"sqlite:///{tmp_path/'test_retry.db'}")
    monkeypatch.setattr(cfg.settings, "job_max_retries", 2)
    monkeypatch.setattr(cfg.settings, "run_inprocess_worker", False)
    monkeypatch.setattr(db_mod, "_engine", None)
    monkeypatch.setattr(db_mod, "_sessionmaker", None)

    class FlakyProvider:
        def __init__(self) -> None:
            self.calls = 0

        def generate_house_spec(self, *, prompt: str, bedrooms: int, bathrooms: int, style: str):
            self.calls += 1
            if self.calls == 1:
                request = httpx.Request("POST", "https://generativelanguage.googleapis.com")
                response = httpx.Response(503, request=request)
                raise httpx.HTTPStatusError("transient", request=request, response=response)
            return ProviderSpecResult(
                spec=_make_spec(bedrooms=bedrooms, bathrooms=bathrooms, style=style),
                meta=ProviderMeta(provider="test", model="flaky"),
            )

        def maybe_generate_exterior_image(self, *, prompt: str, style: str):
            return None

    provider = FlakyProvider()
    monkeypatch.setattr(worker_mod, "_provider", lambda: provider)

    app = create_app()
    with TestClient(app) as client:
        r = client.post("/api/v1/auth/signup", json={"email": "retry@example.com", "password": "password123"})
        assert r.status_code == 200
        r = client.post("/api/v1/sessions", json={"title": "Retry Session"})
        assert r.status_code == 200
        session_id = r.json()["id"]

        r = client.post(
            f"/api/v1/jobs/sessions/{session_id}",
            json={
                "prompt": "3 bed 2 bath",
                "bedrooms": 3,
                "bathrooms": 2,
                "style": "contemporary",
                "want_exterior_image": False,
            },
        )
        assert r.status_code == 200
        data = _wait_for_terminal(client, r.json()["id"])
        assert data["status"] == "succeeded"
        assert data["retry_count"] == 1
        assert data["failure_code"] is None


def test_permanent_provider_failure_does_not_retry(tmp_path, monkeypatch):
    from app import config as cfg
    from app import db as db_mod
    from app.jobs import worker as worker_mod

    monkeypatch.setattr(cfg.settings, "var_dir", tmp_path)
    monkeypatch.setattr(cfg.settings, "database_url", f"sqlite:///{tmp_path/'test_permanent.db'}")
    monkeypatch.setattr(cfg.settings, "job_max_retries", 2)
    monkeypatch.setattr(cfg.settings, "run_inprocess_worker", False)
    monkeypatch.setattr(db_mod, "_engine", None)
    monkeypatch.setattr(db_mod, "_sessionmaker", None)

    class PermanentFailureProvider:
        def generate_house_spec(self, *, prompt: str, bedrooms: int, bathrooms: int, style: str):
            request = httpx.Request("POST", "https://generativelanguage.googleapis.com")
            response = httpx.Response(400, request=request)
            raise httpx.HTTPStatusError("bad request", request=request, response=response)

        def maybe_generate_exterior_image(self, *, prompt: str, style: str):
            return None

    monkeypatch.setattr(worker_mod, "_provider", lambda: PermanentFailureProvider())

    app = create_app()
    with TestClient(app) as client:
        r = client.post(
            "/api/v1/auth/signup", json={"email": "permanent@example.com", "password": "password123"}
        )
        assert r.status_code == 200
        r = client.post("/api/v1/sessions", json={"title": "Permanent Failure Session"})
        assert r.status_code == 200
        session_id = r.json()["id"]

        r = client.post(
            f"/api/v1/jobs/sessions/{session_id}",
            json={
                "prompt": "3 bed 2 bath",
                "bedrooms": 3,
                "bathrooms": 2,
                "style": "modern_farmhouse",
                "want_exterior_image": False,
            },
        )
        assert r.status_code == 200
        data = _wait_for_terminal(client, r.json()["id"])
        assert data["status"] == "failed"
        assert data["retry_count"] == 0
        assert data["failure_code"] == "provider_permanent"


def test_system_health_exposes_worker_heartbeat(tmp_path, monkeypatch):
    from app import config as cfg
    from app import db as db_mod

    monkeypatch.setattr(cfg.settings, "var_dir", tmp_path)
    monkeypatch.setattr(cfg.settings, "database_url", f"sqlite:///{tmp_path/'test_health.db'}")
    monkeypatch.setattr(cfg.settings, "run_inprocess_worker", False)
    monkeypatch.setattr(db_mod, "_engine", None)
    monkeypatch.setattr(db_mod, "_sessionmaker", None)

    app = create_app()
    with TestClient(app) as client:
        time.sleep(0.2)
        r = client.get("/api/v1/system/health")
        assert r.status_code == 200
        body = r.json()
        assert "worker" in body
        assert "heartbeat_age_seconds" in body["worker"]
        assert body["queue_backend"]["kind"] == "db_polling"
