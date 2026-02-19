# Developer Troubleshooting Decision Tree

## 1. App does not load

1. Check web process:
2. `cd web && npm run dev`
3. Check API health:
4. `curl -fsS http://127.0.0.1:8000/api/v1/system/health`
5. If health fails, start backend stack first.

## 2. Auth appears disabled unexpectedly

1. Verify Firebase env keys in `deploy/env/.env.prod`.
2. Run:
3. `bash scripts/validate_firebase_env_parity.sh`
4. Confirm runtime badge in app chrome (`gemini` / `local/mock`).

## 3. Jobs stuck queued/running

1. Check worker heartbeat in health response.
2. Run failure and reliability diagnostics:
3. `pytest -q api/tests/test_queue_reliability.py`
4. Inspect `var/worker_heartbeat.json` and `var/reports/*`.

## 4. Retry behavior looks wrong

1. Validate retry policy:
2. `pytest -q api/tests/test_retry_policy_spec.py`
3. Run transient stress:
4. `bash scripts/run_prebeta_validation.sh`
5. Inspect `var/reports/retry-adherence.json`.

## 5. UI regressions or layout issues

1. Run:
2. `cd web && npm run lint && npm run build`
3. `cd web && npm run test:e2e:smoke`
4. For responsive evidence:
5. `cd web && npx playwright test e2e/responsive.spec.ts`
