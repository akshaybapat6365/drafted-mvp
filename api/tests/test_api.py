from __future__ import annotations

import io
import time
import zipfile

from fastapi.testclient import TestClient

from app.main import create_app


def _wait_for_terminal(client: TestClient, job_id: str, tries: int = 80) -> dict:
    for _ in range(tries):
        r = client.get(f"/api/v1/jobs/{job_id}")
        assert r.status_code == 200
        data = r.json()
        if data["status"] in {"succeeded", "failed"}:
            return data
        time.sleep(0.1)
    raise AssertionError("job did not reach terminal state")


def test_end_to_end_job_creates_artifacts_and_export(tmp_path, monkeypatch):
    from app import config as cfg

    monkeypatch.setattr(cfg.settings, "var_dir", tmp_path)
    monkeypatch.setattr(cfg.settings, "database_url", f"sqlite:///{tmp_path/'test.db'}")

    app = create_app()
    with TestClient(app) as client:
        r = client.post("/api/v1/auth/signup", json={"email": "a@example.com", "password": "password123"})
        assert r.status_code == 200

        r = client.post("/api/v1/sessions", json={"title": "My Studio"})
        assert r.status_code == 200
        session_id = r.json()["id"]

        r = client.post(
            f"/api/v1/jobs/sessions/{session_id}",
            json={
                "prompt": "3 bed 2 bath modern farmhouse with open kitchen",
                "bedrooms": 3,
                "bathrooms": 2,
                "style": "modern_farmhouse",
            },
        )
        assert r.status_code == 200
        job_id = r.json()["id"]

        data = _wait_for_terminal(client, job_id)
        assert data["status"] == "succeeded"
        assert isinstance(data["stage_timestamps"], dict)
        assert "spec" in data["stage_timestamps"]
        assert "done" in data["stage_timestamps"]

        r = client.get(f"/api/v1/jobs/{job_id}/artifacts")
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(a["type"] == "plan_svg" for a in items)
        assert any(a["type"] == "spec_json" for a in items)
        assert all("checksum_sha256" in a for a in items)

        r = client.post(f"/api/v1/jobs/{job_id}/export")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/zip")

        with zipfile.ZipFile(io.BytesIO(r.content), "r") as z:
            names = set(z.namelist())
            assert "manifest.json" in names
            assert "plan.svg" in names
            assert "spec.json" in names


def test_idempotency_returns_same_job(tmp_path, monkeypatch):
    from app import config as cfg

    monkeypatch.setattr(cfg.settings, "var_dir", tmp_path)
    monkeypatch.setattr(cfg.settings, "database_url", f"sqlite:///{tmp_path/'test.db'}")

    app = create_app()
    with TestClient(app) as client:
        r = client.post("/api/v1/auth/signup", json={"email": "b@example.com", "password": "password123"})
        assert r.status_code == 200
        r = client.post("/api/v1/sessions", json={"title": "S1"})
        session_id = r.json()["id"]

        payload = {
            "prompt": "4 bed 3 bath contemporary",
            "bedrooms": 4,
            "bathrooms": 3,
            "style": "contemporary",
            "idempotency_key": "same-key-1",
        }
        r1 = client.post(f"/api/v1/jobs/sessions/{session_id}", json=payload)
        r2 = client.post(f"/api/v1/jobs/sessions/{session_id}", json=payload)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["id"] == r2.json()["id"]

