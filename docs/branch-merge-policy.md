# Branch and Merge Policy

## Branch Model

- `main`: release-ready branch.
- `beta`: stabilization branch for pre-release verification.
- `feature/*`: implementation branches.
- `hotfix/*`: urgent production fixes.

## Pull Request Requirements

- Link issue/task in PR description.
- Include validation evidence (lint/build/smoke or gate outputs).
- Include risk note and rollback note.
- Require reviewer approval before merge.

## Commit Policy

- Conventional style:
  - `feat(...)`
  - `fix(...)`
  - `chore(...)`
  - `docs(...)`
- Each commit must be scoped and logically atomic.

## Merge Policy

- Prefer squash merge for feature branches.
- Do not merge when required checks fail.
- Do not bypass branch protections except documented emergency procedure.
- If GitHub plan cannot enforce required checks:
  - treat `prebeta-gate` and `firebase-ci` workflow success as manual required gate.
  - include workflow run URLs in PR evidence before merge.
