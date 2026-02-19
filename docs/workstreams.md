# Workstream Matrix

## Streams and Ownership

- Frontend
  - Scope: route UX, component behavior, runtime badges, error surfaces.
  - Outputs: updated `web/src/**`, smoke evidence.
- Backend/API
  - Scope: endpoint contract integrity, retry/idempotency behavior.
  - Outputs: API contract notes, tests.
- Infrastructure/CI
  - Scope: workflows, deploy scripts, gate artifacts.
  - Outputs: workflow runs, reports.
- QA/Reliability
  - Scope: load/failure-injection execution and gate decisions.
  - Outputs: `var/reports/**`, beta gate report.
- Security/Compliance
  - Scope: auth/session security review, artifact access review.
  - Outputs: security findings and mitigations.

## Dependency Order

1. Contract and runtime behavior.
2. Frontend implementation.
3. CI/reliability gates.
4. Release decision.

