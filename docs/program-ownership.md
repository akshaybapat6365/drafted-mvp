# Program Ownership and Escalation Matrix

This document defines who owns execution and how incidents are escalated.

## Roles

- Program Owner: accountable for delivery scope, release decisions, and risk acceptance.
- Deputy Owner: backup approver for merges, deploys, and incident triage.
- Workstream Leads:
  - Frontend Lead
  - Backend/API Lead
  - Infrastructure/CI Lead
  - QA/Reliability Lead

## Decision Authority

- Product scope changes: Program Owner.
- Reliability gate overrides: Program Owner + QA Lead.
- Security-risk acceptance: Program Owner + Security reviewer.
- Emergency rollback: Infrastructure Lead (notify Program Owner immediately).

## Escalation Levels

- Sev 0: data loss, security incident, legal/compliance risk.
  - Escalate immediately to Program Owner and stop deployment activity.
- Sev 1: production outage or broken critical user path.
  - Escalate within 15 minutes to Program Owner and all leads.
- Sev 2: degraded functionality, temporary workaround exists.
  - Escalate within 60 minutes to workstream leads.
- Sev 3: minor bug or polish issue.
  - Track in backlog; no immediate escalation required.

## Daily Completion Report Format

Each day post one report with:

- Date (UTC)
- Completed work (files, workflows, tests run)
- In-progress work
- Blockers and owner
- Risks and mitigation updates
- Next 24-hour plan

