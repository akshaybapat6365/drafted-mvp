## Summary

- What changed:
- Why:

## Scope

- In scope:
- Out of scope:

## Validation

- [ ] `web`: `npm run lint`
- [ ] `web`: `npm run build`
- [ ] `web`: `npm run perf:budgets`
- [ ] smoke-check `/app`, `/app/drafts/new`, `/app/jobs/[jobId]`
- [ ] API tests (if backend touched)
- [ ] config/security parity checks:
  - `bash scripts/validate_firebase_env_parity.sh`
  - `bash scripts/check_firestore_isolation.sh`
  - `python3 scripts/check_endpoint_parity.py`

## Risk and Rollback

- Risk level: low / medium / high
- Rollback approach:

## Evidence

- Screenshots/logs/artifacts:

## Checklist

- [ ] No unrelated files included
- [ ] Runtime mode behavior verified
- [ ] Error/retry states verified
- [ ] Documentation updated if needed
