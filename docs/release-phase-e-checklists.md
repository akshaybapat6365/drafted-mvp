# Phase E Release Execution Checklists

## Step 84: Required checks policy

1. Required workflows:
2. `firebase-ci`
3. `prebeta-gate`
4. Fallback when plan-limited:
5. manual enforcement in PR template with workflow evidence links.

## Step 86: Staging readiness sign-off

1. Environment parity:
2. `bash scripts/validate_firebase_env_parity.sh`
3. `bash scripts/check_firestore_isolation.sh`
4. Endpoint parity:
5. `python3 scripts/check_endpoint_parity.py`
6. Build + tests:
7. `cd web && npm run lint && npm run build && npm run perf:budgets`
8. `cd api && pytest -q`

## Step 87: Staging shakeout cycle

1. Run:
2. `bash scripts/run_prebeta_validation.sh`
3. Verify reports:
4. `var/reports/beta-gate-report.md`
5. `var/reports/retry-adherence.md`
6. `var/reports/failure-injection/sequence.txt`

## Step 88: Structured defect triage sprint

1. Severity mapping from `docs/qa-handbook.md`.
2. SLA:
3. Sev0 immediate stop-ship.
4. Sev1 fix before beta.
5. Sev2 tracked with owner + ETA.

## Step 89: Regression lock run

1. Zero Sev0 gate.
2. Retry adherence gate pass.
3. Idempotency race/restart tests pass.
4. UI smoke and responsive evidence captured.

## Step 90: Beta go/no-go minutes

1. Include:
2. date/time
3. attendees
4. gates pass/fail summary
5. go/no-go decision and rationale
6. follow-up actions with owners

## Step 91-92: Production cutover and phased deployment

1. Freeze window and comms timeline published.
2. Execute deployment checklist:
3. infra rollout
4. backend rollout
5. web rollout
6. post-deploy smoke

## Step 93-95: Early live stabilization

1. Hour-0 verification:
2. auth, session, job submit, artifacts, export, telemetry.
3. Hour-24 report:
4. error and latency trend
5. retry adherence
6. mitigation actions
7. Week-1 hardening backlog:
8. top defects
9. debt removals
10. owners and due dates

## Step 96-97 and 99: KPI/debt/handoff

1. Compare live KPIs to pre-launch baseline in `docs/success-criteria.md`.
2. Re-baseline thresholds if behavior shifted materially.
3. Convert temporary mitigations into debt tickets with fixed deadlines.
4. Final operational handoff with named primary/deputy owners in `docs/program-ownership.md`.
