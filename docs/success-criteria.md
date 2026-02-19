# Success Criteria and Release Gates

## Product Success Criteria

- Route functionality:
  - `/app`, `/app/drafts/new`, `/app/jobs/[jobId]` must pass smoke flow.
- Reliability:
  - no lost accepted jobs in reliability gate reports,
  - retry adherence at or above configured threshold.
- UX:
  - all critical controls have loading/disabled/error states.

## Engineering Gates

- `npm run lint` passes in `web`.
- `npm run build` passes in `web`.
- API test suite passes.
- Prebeta reliability workflow artifacts generated.

## Go / No-Go Conditions

Go:

- all required gates pass,
- no open Sev 0/Sev 1 defects,
- rollback path verified.

No-Go:

- any required gate fails,
- unresolved security issue,
- unresolved data-integrity risk.

