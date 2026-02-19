# Scope Freeze

## In Scope (Current Delivery Window)

- Web app routes:
  - `/`
  - `/login`
  - `/signup`
  - `/app`
  - `/app/drafts/new`
  - `/app/jobs/[jobId]`
- Dual-mode runtime UX (Firebase primary, local fallback).
- Reliability hardening for request lifecycle, retry/backoff, stale-data handling.
- CI reliability gates and deployment runbooks already present in repo.

## Out of Scope (Current Window)

- New billing/payments surface.
- Team collaboration/multi-tenant admin console.
- New backend domain features outside reliability and contract hardening.
- Full design-system rewrite beyond existing route set.

## Change Control

- Any out-of-scope request requires:
  1. written change request,
  2. impact estimate,
  3. owner approval before implementation.

