# Data Freshness and Cache Policy

## Freshness Signals

- `last sync` timestamp must be shown on major data routes.
- `live data` / `stale data` state must be visible where partial refresh can fail.

## Refresh Triggers

- Manual refresh via user action.
- Polling for non-terminal job states only.
- Polling pauses when tab is not visible.

## Stale Data Behavior

- Preserve last known good data where possible.
- Surface warning state with recovery action.
- Do not silently clear previously valid UI state.

## Implementation notes

- Web API client forces `cache: no-store` for all API requests.
- Request headers include:
  - `x-client-cache-policy: no-store`
  - `x-trace-id`
- API and Functions responses include `cache-control: no-store`.
