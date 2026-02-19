# Responsive Test Matrix

## Route Matrix

Test each route at minimum viewport widths:

- 320px
- 768px
- 1024px
- 1440px

Routes:

- `/`
- `/login`
- `/signup`
- `/app`
- `/app/drafts/new`
- `/app/jobs/[jobId]`

Automation:

- `web/e2e/responsive.spec.ts`
- output: `var/reports/ui/*.png`

## Required Checks

- No horizontal overflow.
- Navigation remains usable.
- Critical CTA remains visible without overlap.
- Timeline/code blocks remain readable and scroll safely.
