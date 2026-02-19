# Accessibility Checklist

Use this checklist before merge for any user-facing route change.

## Keyboard and Focus

- All actionable elements are keyboard reachable.
- Focus order follows visual order.
- Focus ring is visible on all interactive controls.

## Semantics

- Inputs have labels.
- Buttons and links have clear accessible names.
- Heading hierarchy is valid per page.

## Visual Accessibility

- Text and status colors meet contrast expectations.
- Error and warning states are distinguishable without color alone.
- Reduced motion setting is respected for animated surfaces.

## Automated and scripted checks

- `web/e2e/accessibility-keyboard.spec.ts`
- `web/e2e/smoke.spec.ts`
