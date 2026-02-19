# Risk Register

| ID | Risk | Trigger | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-01 | Runtime-mode confusion | Mixed auth/runtime states | User lockout and support load | Explicit runtime badge + fallback copy | Frontend |
| R-02 | Retry policy drift | Provider transient behavior changes | Lost jobs or duplicate terminal states | Keep retry-adherence gate in CI | QA/Reliability |
| R-03 | Endpoint contract drift | Backend/Frontend mismatch | Broken route functionality | Contract docs + typed interfaces | Backend/API |
| R-04 | Branch protection gaps | Plan/permission limits | Unverified merges to main | Workflow gates + manual release checklist | Infra/CI |
| R-05 | Artifact access misconfiguration | Storage/signing errors | Download failures or exposure risk | Access tests + audit trail review | Security |
| R-06 | Stale UI data under transient failures | Partial refresh failures | Misleading user state | Stale-data badge + manual refresh path | Frontend |

