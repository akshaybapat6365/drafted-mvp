# Static Quality Policy

## Required Commands

- `web`: `npm run lint` and `npm run build`
- `api`: `pytest -q`

## Gate Behavior

- Do not merge when lint/build fail.
- Do not merge when required reliability gate fails.

## Warning Policy

- New warnings are treated as debt and must be either fixed or documented with owner and follow-up date.

## Exception Process

- Temporary exceptions require:
  1. explicit rationale,
  2. owner,
  3. removal target date.
- ESLint exception file:
  - `web/.eslint-exceptions.json`
  - should only list files that intentionally permit console output.
