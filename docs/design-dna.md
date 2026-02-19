# Design DNA (Execution Standard)

## Intent

Deliver a mission-control UI language that is high-clarity, high-contrast, and state-transparent.

## Principles

- Show runtime truth, never hide mode.
- Every async action exposes loading, failure, and recovery.
- Data surfaces should degrade safely under partial failures.
- Typography and spacing should remain consistent across auth/app routes.

## Visual Direction

- Command-center composition with strong hierarchy.
- Deliberate color semantics:
  - success, warning, danger, neutral, accent.
- Consistent tokenized styling over ad-hoc utility drift.

## Motion Rules

- Functional motion only.
- Disable aggressive animation for error/critical states.
- Keep transitions short and deterministic.

