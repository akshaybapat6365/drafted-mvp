# Staging Shakeout Checklist

## Pre-Shakeout

- Deploy current candidate to staging.
- Confirm health endpoint is green.
- Confirm required env vars are present.

## Functional Pass

- Smoke routes:
  - `/app`
  - `/app/drafts/new`
  - `/app/jobs/[jobId]`
- Validate auth flow in configured runtime mode.

## Reliability Pass

- Run prebeta validation sequence.
- Verify artifact uploads from workflow run.
- Confirm no lost jobs and acceptable retry adherence.

## Exit Criteria

- No Sev 0/Sev 1 defects open.
- Reliability SLO gates pass.
- Rollback rehearsal validated.

