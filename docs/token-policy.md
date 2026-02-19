# Token and Style Policy

## Token Authority

- Use CSS variables in `web/src/app/globals.css` as source of truth.
- Do not introduce one-off hardcoded colors in component files unless justified.

## Required Usage

- Buttons, badges, panels, and status labels must use semantic token classes.
- New components must support dark/light mode via existing token scheme.

## Forbidden Patterns

- Hardcoded random hex values in route components.
- Inconsistent spacing scales for equivalent UI groups.
- Parallel token systems outside `globals.css` without review.

## Review Checklist

- Does the change use existing semantic tokens?
- Does it preserve contrast and readable state semantics?
- Does it avoid token duplication?

