# Beta Gate Report

- Generated: 2026-02-17T00:44:14Z
- Baseline load duration: 3m
- Transient stress duration: 4m

## Baseline and failure-injection evidence

- `var/reports/load-run/k6-baseline.txt`
- `var/reports/failure-injection/sequence.txt`
- `var/reports/failure-injection/health-*.json`
- `var/reports/failure-injection/health-post-faults.json`

## Transient retry-adherence metrics

- jobs_total: 11532
- jobs_succeeded: 11432
- jobs_failed: 100
- retry_adherence_pct: 100.000
- lost_jobs: 0
- duplicate_terminal_idempotency: 0

## Evaluation

See:

- `var/reports/retry-adherence.json`
- `var/reports/retry-adherence.md`
