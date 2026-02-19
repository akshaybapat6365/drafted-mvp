#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
FUNCTIONS_FILE = ROOT / "functions" / "src" / "index.ts"
API_FILES = sorted((ROOT / "api" / "app" / "api" / "routes").glob("*.py"))
REPORT_DIR = ROOT / "var" / "reports" / "parity"
REPORT_JSON = REPORT_DIR / "endpoint-parity.json"
REPORT_MD = REPORT_DIR / "endpoint-parity.md"

EXPECTED = [
    ("GET", "/api/v1/system/health"),
    ("POST", "/api/v1/sessions"),
    ("GET", "/api/v1/sessions"),
    ("GET", "/api/v1/jobs"),
    ("GET", "/api/v1/jobs/sessions/{sessionId}"),
    ("POST", "/api/v1/jobs/sessions/{sessionId}"),
    ("GET", "/api/v1/jobs/{jobId}"),
    ("POST", "/api/v1/jobs/{jobId}/regenerate"),
    ("GET", "/api/v1/jobs/{jobId}/artifacts"),
    ("GET", "/api/v1/jobs/{jobId}/artifacts/{artifactId}/download"),
    ("POST", "/api/v1/jobs/{jobId}/export"),
    ("GET", "/api/v1/me/limits"),
]


def canonicalize(path: str) -> str:
    normalized = path
    normalized = normalized.replace(":sessionId", "{sessionId}")
    normalized = normalized.replace(":jobId", "{jobId}")
    normalized = normalized.replace(":artifactId", "{artifactId}")
    normalized = normalized.replace("{session_id}", "{sessionId}")
    normalized = normalized.replace("{job_id}", "{jobId}")
    normalized = normalized.replace("{artifact_id}", "{artifactId}")
    return normalized


def parse_functions_routes() -> set[tuple[str, str]]:
    text = FUNCTIONS_FILE.read_text(encoding="utf-8")
    matches = re.findall(r'app\.(get|post)\(\s*"([^"]+)"', text, flags=re.MULTILINE)
    return {(method.upper(), canonicalize(path)) for method, path in matches}


def parse_fastapi_routes() -> set[tuple[str, str]]:
    routes: set[tuple[str, str]] = set()
    for file in API_FILES:
        text = file.read_text(encoding="utf-8")
        prefix_match = re.search(r'APIRouter\(\s*prefix="([^"]+)"', text)
        prefix = prefix_match.group(1) if prefix_match else ""
        matches = re.findall(r'@router\.(get|post)\(\s*"([^"]*)"', text, flags=re.MULTILINE)
        for method, rel in matches:
            full = f"/api/v1{prefix}{rel}"
            routes.add((method.upper(), canonicalize(full)))
    return routes


def main() -> int:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    fn_routes = parse_functions_routes()
    api_routes = parse_fastapi_routes()

    rows: list[dict[str, object]] = []
    failed = False
    for method, endpoint in EXPECTED:
        key = (method, endpoint)
        fn_has = key in fn_routes
        api_has = key in api_routes
        ok = fn_has and api_has
        if not ok:
            failed = True
        rows.append(
            {
                "method": method,
                "endpoint": endpoint,
                "functions": fn_has,
                "api": api_has,
                "ok": ok,
            }
        )

    payload = {
        "generated_at": dt.datetime.now(dt.UTC).isoformat(),
        "rows": rows,
        "failed": failed,
    }
    REPORT_JSON.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Endpoint Parity Report",
        "",
        "| Method | Endpoint | Functions | API | OK |",
        "| --- | --- | --- | --- | --- |",
    ]
    for row in rows:
        lines.append(
            f"| {row['method']} | {row['endpoint']} | {row['functions']} | {row['api']} | {row['ok']} |"
        )
    REPORT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(str(REPORT_MD.relative_to(ROOT)))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
