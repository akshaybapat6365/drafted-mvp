# Error Taxonomy

## Categories

- `auth_*`: authentication/authorization issues.
- `validation_*`: request schema or business-rule violations.
- `provider_*`: external model/provider failures.
- `idempotency_conflict`: concurrent conflicting request with same dedupe key.
- `artifact_missing`: artifact expected but unavailable.
- `network`: transport/connectivity failures.
- `timeout`: request timed out.
- `retry_exhausted`: retries consumed without success.
- `system_*`: unexpected internal errors.

## Retryability Rules

- Retryable:
  - `network`
  - `timeout`
  - transient `provider_*`
  - HTTP `408`, `425`, `429`, `5xx`
- Non-retryable:
  - validation errors
  - unauthorized/forbidden
  - permanent provider rejection

## UI Contract

- Show user-safe `message`.
- Show optional `code` tag for diagnosis.
- Show retry hint only for retryable category.
- Show attempts count when attempts > 1.
