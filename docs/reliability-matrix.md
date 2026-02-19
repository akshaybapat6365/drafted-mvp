# Queue Reliability Matrix

Policy source of truth: `docs/retry-policy.json`.

## Failure classes and expected outcomes

| Class | Trigger examples | Retryable | Expected stage flow | Terminal status |
| --- | --- | --- | --- | --- |
| `provider_transient` | `408/409/425/429/500/502/503/504`, network timeout | yes | `spec|image -> retry_wait -> queued/running` | `succeeded` or `failed` (if retries exhausted) |
| `provider_permanent` | provider `4xx` non-transient (for example `400`) | no | `spec|image -> done` | `failed` |
| `validation` | schema/room-count mismatch | no | `spec|plan -> done` | `failed` |
| `system` | unclassified internal exceptions | no | `* -> done` | `failed` |

## Enforcement

1. Worker classifier tests:
2. `api/tests/test_queue_reliability.py`
3. `api/tests/test_retry_policy_spec.py`
4. Reliability gates:
5. `tests/reliability/collect_retry_metrics.sh`
6. `tests/reliability/evaluate_retry_adherence.sh`
7. Pre-beta and nightly workflows execute the same gates with different load/failure durations.

## Evidence artifacts

1. `var/reports/retry-adherence.json`
2. `var/reports/retry-adherence.md`
3. `var/reports/beta-gate-report.md`
