# Operations Runbook

## Deploy

- Use documented flow in:
  - `docs/deployment-vm.md`
  - `docs/firebase-native-deployment.md`

## Rollback

- Primary rollback command path:
  - `deploy/scripts/rollback.sh`
- Rollback must be followed by health check and smoke pass.

## Incident Handling

1. Classify severity.
2. Stabilize service (rollback or mitigation).
3. Capture evidence and timeline.
4. Publish incident note and owner.

## Alert thresholds

1. Retry adherence below `99.5%` for `10m`: page on-call.
2. API p95 latency above `1500ms` for `15m`: warn + investigate.
3. Queued jobs above `200` for `15m`: warn + queue drain actions.
4. Alert rules source: `deploy/observability/alerts/reliability-alerts.yml`.

## Incident notification workflow

1. Acknowledge alert within 5 minutes.
2. Assign incident commander and note affected environments.
3. Post first status update within 10 minutes.
4. Attach report artifacts from `var/reports/*`.

## Postmortem Minimum

- Root cause
- Detection gap
- Customer impact
- Corrective actions
- Preventive actions
