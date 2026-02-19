# QA Handbook

## Core Validation Pass

1. `web`: lint and build.
2. `web`: `npm run test:e2e:smoke`.
2. Route smoke:
  - `/app`
  - `/app/drafts/new`
  - `/app/jobs/[jobId]`
3. Responsive capture suite:
  - `web/e2e/responsive.spec.ts` (mobile/tablet/desktop)
4. Keyboard and accessibility traversal:
  - `web/e2e/accessibility-keyboard.spec.ts`
5. Verify key action controls and error states.
6. Backend reliability + security:
  - `pytest -q`

## Evidence Capture

- Keep command outputs and screenshots for failed checks.
- Record exact route, user action, observed result, expected result.
- Attach run timestamp and branch/commit.
- Store generated evidence under `var/reports/`.

## Severity Mapping

- Sev 0: security/data-loss behavior.
- Sev 1: critical user path broken.
- Sev 2: major degradation with workaround.
- Sev 3: minor defect or polish issue.
