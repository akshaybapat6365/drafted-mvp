# Retry Adherence Evaluation

- Generated: 2026-02-17T00:44:14Z
- Source metrics: `/Users/akshaybapat/drafted-mvp/var/reports/retry-adherence.json`

## Inputs

- jobs_total: 11532
- jobs_succeeded: 11432
- jobs_failed: 100
- retryable_total: 100
- retry_adherence_pct: 100.000
- lost_jobs: 0
- duplicate_terminal_idempotency: 0

## Gates

1. Retry adherence >= 99.5: **pass**
2. Retryable sample size > 0: **pass**
3. Lost jobs == 0: **pass**
4. Duplicate terminal idempotency == 0: **pass**

## Overall

**pass**
