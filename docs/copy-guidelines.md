# Copy and Terminology Guidelines

## Primary Terms

- Session: a workspace grouping of jobs.
- Job: one draft generation execution.
- Artifact: generated output file (plan, spec, image, export).
- Runtime mode: provider context (`gemini`, `mock`, `unknown`).

## CTA Rules

- Use action-first verbs:
  - `Create session`
  - `Create draft job`
  - `Refresh`
  - `Regenerate`
  - `Export zip`

## Error Copy Rules

- Be explicit, short, and actionable.
- Include login recovery cue for unauthorized states.
- Avoid exposing sensitive internals in user message text.

