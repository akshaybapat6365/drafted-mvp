# No-Stop Execution Policy

This policy defines how execution continues without unnecessary pauses.

## Core Rule

- Continue through planned steps until completion.
- Do not pause for non-critical ambiguity; use documented defaults.

## Allowed Automatic Retries

- Transient API/network failures: retry with bounded backoff.
- CI transient infrastructure failures: one rerun, then escalate.
- Non-deterministic test flake: one rerun with evidence attached.

## Hard-Stop Conditions

Stop only for:

- Security incident or suspected credentials exposure.
- Data-loss risk or destructive migration risk.
- Legal/compliance risk requiring explicit approval.

## Resume Protocol

When a hard-stop condition clears:

1. Record root cause and mitigation in incident notes.
2. Re-run last blocked gate.
3. Resume from the interrupted step, not from scratch.

## Escalation Time Targets

- Sev 0: immediate
- Sev 1: within 15 minutes
- Sev 2: within 60 minutes

