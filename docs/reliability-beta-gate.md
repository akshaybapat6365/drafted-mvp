# Reliability Beta Gate (Queue + Retry + Failure Injection)

## Objective

Prove that the job queue pipeline remains correct under load and transient failures:

- No accepted jobs are lost.
- Retry logic is applied only for retryable failures.
- Idempotent requests do not produce duplicate terminal completions.
- System returns to steady state after worker/provider/infra disruptions.

## SLO gates

1. `lost_jobs = 0`
2. `duplicate_terminal_jobs_for_same_idempotency_key = 0`
3. `retry_policy_adherence >= 99.5%`
4. `non_retryable_failures_terminalized = 100%`

## Inputs

- Load script: `tests/load/k6_jobs.js`
- Transient load script: `tests/load/k6_jobs_transient.js`
- Failure scripts: `tests/failure/*.sh`
- Retry metrics collector: `tests/reliability/collect_retry_metrics.sh`
- Retry evaluator: `tests/reliability/evaluate_retry_adherence.sh`
- Unified orchestrator: `scripts/run_prebeta_validation.sh`
- API endpoint: `GET /api/v1/system/health`

## Suggested beta gate sequence

1. Baseline load with no fault injection for 15 minutes.
2. Worker outage injection during load (`kill_worker.sh`).
3. Provider/network outage simulation (`block_provider.sh`).
4. Redis restart and DB pause events during load.
5. Validate queue drains to stable baseline.
6. Run deterministic transient-provider stress pass (stub mode enabled) and score retry adherence.

## Evidence to capture

- Health snapshots before/after each failure event.
- Job terminal counts (`succeeded`, `failed`) and retry distributions.
- Failure-code breakdown (`provider_transient`, `provider_permanent`, `validation`, `system`).
- End-to-end job completion latency percentiles.
- Retry adherence report (`var/reports/retry-adherence.json` + `var/reports/retry-adherence.md`).

## Pass criteria

All SLO gates pass for two consecutive full runs.

## CI gate workflows

- Required PR gate: `.github/workflows/prebeta-gate.yml`
- Extended soak gate: `.github/workflows/nightly-reliability.yml`

Both workflows:

1. run API tests,
2. run compose dry-run + load/failure sequence,
3. run deterministic transient retry-adherence stress pass,
4. always upload `var/reports/**`,
5. always teardown compose stack.
