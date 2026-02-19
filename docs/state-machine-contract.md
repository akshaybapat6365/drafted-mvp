# UI Async State Machine Contract

All async screens and actions should map to:

- `idle`
- `loading`
- `success`
- `error`

## Route-Level Rules

- First load uses skeleton/loading state.
- Refresh state must not wipe previously valid data unless no previous data exists.
- Error state should preserve recoverable controls.

## Action-Level Rules

- Disable duplicate submits while loading.
- Show deterministic loading label.
- On success, transition to next expected state/route.
- On error, show structured error panel (`message`, optional `code`, optional retry hint).

## Implementation reference

- Shared utility: `web/src/lib/asyncState.ts`
- Applied on:
  - `web/src/app/app/page.tsx`
  - `web/src/app/app/drafts/new/newDraftClient.tsx`
  - `web/src/app/app/jobs/[jobId]/JobDetailClient.tsx`
