# Observability Plan

## Objectives

- Correlate user actions to API/backend processing using a shared trace ID.
- Track error frequency, retry behavior, and degraded runtime states.

## Minimum Instrumentation

- Frontend route events:
  - route view
  - action start
  - action success
  - action error
- API request metadata:
  - trace ID
  - status code
  - error code
  - attempts

## Dashboards (Required)

- Route success/error rate by runtime mode.
- Retryable error trends over time.
- Job lifecycle latency and terminal status distribution.

## Alerts (Required)

- Error-rate spike above baseline.
- Retry adherence drop below configured threshold.
- Job completion failure spike.

## Implemented artifacts

- Dashboard: `deploy/observability/grafana/drafted-reliability-dashboard.json`
- Alert rules: `deploy/observability/alerts/reliability-alerts.yml`
- Frontend telemetry transport: `web/src/lib/telemetry.ts`
- Backend event ingest + request tracing: `api/app/api/routes/system.py`, `api/app/main.py`
