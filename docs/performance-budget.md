# Performance Budget

## Web Route Budgets

- Initial route interactive target: <= 3.0s on standard developer laptop baseline.
- User-triggered action feedback target: <= 200ms visual response.
- Largest route payload should avoid avoidable large client-side dependencies.

## Bundle Discipline

- Avoid introducing heavy libraries for single-use UI effects.
- Prefer existing shared UI primitives and utilities.
- Keep route-level component boundaries intentional to minimize hydration overhead.

## Regression Guard

- Track before/after bundle impact on any significant dependency change.
- Include performance note in PR when route payload changes materially.
- Enforce route-level budgets via `web/scripts/check-route-budgets.mjs` and `web/perf-budgets.json`.
- Generate before/after report via `web/scripts/bundle-report.mjs`.
- CI enforcement path: `.github/workflows/firebase-ci.yml` (`npm run perf:budgets`).
