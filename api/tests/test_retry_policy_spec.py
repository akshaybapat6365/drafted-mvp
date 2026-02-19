from __future__ import annotations

import json
from pathlib import Path

import httpx


def test_retry_policy_json_matches_runtime_classifier():
    from app.jobs import worker as worker_mod

    policy_path = Path(__file__).resolve().parents[2] / "docs" / "retry-policy.json"
    policy = json.loads(policy_path.read_text(encoding="utf-8"))
    classes = policy["failure_classes"]

    transient = worker_mod._classify_failure(httpx.TimeoutException("timeout"))
    assert transient == ("provider_transient", True)
    assert classes["provider_transient"]["retryable"] is True

    req = httpx.Request("POST", "https://generativelanguage.googleapis.com")
    transient_resp = httpx.Response(503, request=req)
    transient_http = worker_mod._classify_failure(
        httpx.HTTPStatusError("temporary", request=req, response=transient_resp)
    )
    assert transient_http == ("provider_transient", True)
    assert 503 in classes["provider_transient"]["transient_http_codes"]

    permanent_resp = httpx.Response(400, request=req)
    permanent_http = worker_mod._classify_failure(
        httpx.HTTPStatusError("bad request", request=req, response=permanent_resp)
    )
    assert permanent_http == ("provider_permanent", False)
    assert classes["provider_permanent"]["retryable"] is False

    validation = worker_mod._classify_failure(ValueError("invalid"))
    assert validation == ("validation", False)
    assert classes["validation"]["retryable"] is False

    system = worker_mod._classify_failure(RuntimeError("boom"))
    assert system == ("system", False)
    assert classes["system"]["retryable"] is False
