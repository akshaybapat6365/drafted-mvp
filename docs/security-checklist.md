# Security Checklist

## Frontend

- No secrets in client bundles.
- Error messages do not expose internal sensitive details.
- External links use safe target/rel attributes.
- Clipboard and download actions have explicit user intent.

## Auth and Session

- Unauthorized states show safe recovery path.
- Expired sessions route to login flow without broken UI loops.
- Runtime mode does not accidentally bypass auth checks.

## Artifact Access

- Download endpoints require authenticated access.
- Signed URLs should have bounded lifetime where applicable.
- Access failures are handled safely and visibly.
- Firestore and Storage direct client access remain denied (`firestore.rules`, `storage.rules`).
- Automated isolation check: `scripts/check_firestore_isolation.sh`.

## Verification Tests

- `api/tests/test_security_observability.py`
- `api/tests/test_idempotency_race.py`
- `api/tests/test_api.py`

## Release Gate

- No open Sev 0 security issues.
- Security checklist signed off before production go/no-go.
