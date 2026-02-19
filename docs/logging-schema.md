# Logging and Event Schema

## Required Core Fields (All Tiers)

- `timestamp_utc`
- `service` (`web`, `api`, `functions`, `worker`)
- `environment`
- `route` or `endpoint`
- `action`
- `status` (`ok`, `error`)
- `runtime_mode` (`gemini`, `mock`, `unknown`)
- `trace_id`

## Error Fields

- `error_code`
- `error_message`
- `retryable`
- `attempts`

## Job Context Fields

- `job_id`
- `session_id`
- `stage`
- `idempotency_key` (if present)

## Frontend Event Naming

- `route_view`
- `action_click`
- `action_success`
- `action_error`
- `retry_scheduled`

## Trace Propagation

- Generate `trace_id` at request entry if absent.
- Propagate downstream via request headers.
- Include same `trace_id` in all related logs/events.

## Implemented components

- Web request trace headers: `web/src/lib/api.ts`
- Web telemetry emitter: `web/src/lib/telemetry.ts`
- API structured logging + request middleware: `api/app/logging.py`, `api/app/main.py`
- API frontend event ingest: `api/app/api/routes/system.py`
- Functions structured logs: `functions/src/logging.ts`, `functions/src/index.ts`, `functions/src/pipeline.ts`
