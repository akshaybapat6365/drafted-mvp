# Release Cutover Checklist

## Before Cutover

- Required checks are green.
- Prebeta gate artifacts reviewed.
- Rollback command path verified.

## Cutover Window

- Freeze non-release merges.
- Deploy candidate.
- Verify health endpoint.
- Run hour-0 smoke on critical routes.

## Immediate Post-Cutover

- Monitor errors and latency.
- Confirm job processing pipeline is healthy.
- Confirm artifact downloads work.

## Rollback Trigger

- Any Sev 0 issue.
- Sustained critical route failure.
- Data integrity anomaly.

