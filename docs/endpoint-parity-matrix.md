# Endpoint Parity Matrix (Functions vs FastAPI)

Generated and enforced by `scripts/check_endpoint_parity.py`.

## Covered API surface

| Method | Canonical endpoint | Functions | FastAPI |
| --- | --- | --- | --- |
| GET | `/api/v1/system/health` | yes | yes |
| POST | `/api/v1/sessions` | yes | yes |
| GET | `/api/v1/sessions` | yes | yes |
| GET | `/api/v1/jobs` | yes | yes |
| GET | `/api/v1/jobs/sessions/{sessionId}` | yes | yes |
| POST | `/api/v1/jobs/sessions/{sessionId}` | yes | yes |
| GET | `/api/v1/jobs/{jobId}` | yes | yes |
| POST | `/api/v1/jobs/{jobId}/regenerate` | yes | yes |
| GET | `/api/v1/jobs/{jobId}/artifacts` | yes | yes |
| GET | `/api/v1/jobs/{jobId}/artifacts/{artifactId}/download` | yes | yes |
| POST | `/api/v1/jobs/{jobId}/export` | yes | yes |
| GET | `/api/v1/me/limits` | yes | yes |

## Continuous validation

1. `python3 scripts/check_endpoint_parity.py`
2. Writes machine report: `var/reports/parity/endpoint-parity.json`
3. Writes human report: `var/reports/parity/endpoint-parity.md`
4. Non-zero exit if any endpoint parity mismatch is detected.

## Accepted deltas

1. Auth implementation details differ (`Firebase ID token` vs `JWT cookie/bearer`), but route contracts stay aligned.
2. Artifact delivery differs by runtime:
3. Functions runtime returns signed URLs.
4. FastAPI runtime streams local files via `FileResponse`.
