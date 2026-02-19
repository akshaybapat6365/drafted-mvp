from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import threading

from fastapi.testclient import TestClient

from app.main import create_app


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


def test_idempotency_race_returns_single_job_id(tmp_path, monkeypatch):
    _reset_runtime(tmp_path, monkeypatch, "idempotency-race.db")
    app = create_app()
    with TestClient(app) as client:
        token = _signup(client, "race@example.com")
        headers = {"authorization": f"Bearer {token}"}
        session = client.post("/api/v1/sessions", json={"title": "Race Session"}, headers=headers)
        assert session.status_code == 200
        session_id = session.json()["id"]

        payload = {
            "prompt": "4 bed 3 bath contemporary with office",
            "bedrooms": 4,
            "bathrooms": 3,
            "style": "contemporary",
            "want_exterior_image": False,
            "idempotency_key": "idempotency-race-key",
        }

        workers = 8
        gate = threading.Barrier(workers)

        def submit_once(_idx: int):
            gate.wait(timeout=5)
            response = client.post(
                f"/api/v1/jobs/sessions/{session_id}",
                json=payload,
                headers=headers,
            )
            return response.status_code, response.json()["id"]

        with ThreadPoolExecutor(max_workers=workers) as pool:
            results = list(pool.map(submit_once, range(workers)))

        statuses = {status for status, _ in results}
        ids = {job_id for _, job_id in results}
        assert statuses == {200}
        assert len(ids) == 1


def test_idempotency_survives_app_restart(tmp_path, monkeypatch):
    _reset_runtime(tmp_path, monkeypatch, "idempotency-restart.db")
    app = create_app()
    with TestClient(app) as client:
        token = _signup(client, "restart@example.com")
        headers = {"authorization": f"Bearer {token}"}
        session = client.post("/api/v1/sessions", json={"title": "Restart Session"}, headers=headers)
        assert session.status_code == 200
        session_id = session.json()["id"]

        payload = {
            "prompt": "3 bed 2 bath restart check",
            "bedrooms": 3,
            "bathrooms": 2,
            "style": "modern_farmhouse",
            "want_exterior_image": False,
            "idempotency_key": "idempotency-restart-key",
        }
        first = client.post(f"/api/v1/jobs/sessions/{session_id}", json=payload, headers=headers)
        assert first.status_code == 200
        first_id = first.json()["id"]

    _reset_runtime(tmp_path, monkeypatch, "idempotency-restart.db")
    app_restarted = create_app()
    with TestClient(app_restarted) as client2:
        login = client2.post(
            "/api/v1/auth/login",
            json={"email": "restart@example.com", "password": "password123"},
        )
        assert login.status_code == 200
        token2 = login.json()["access_token"]
        headers2 = {"authorization": f"Bearer {token2}"}

        second = client2.post(
            f"/api/v1/jobs/sessions/{session_id}",
            json=payload,
            headers=headers2,
        )
        assert second.status_code == 200
        assert second.json()["id"] == first_id
