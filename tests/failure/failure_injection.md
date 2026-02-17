# Failure Injection Scripts

All scripts assume:

- You run them from a deployed release checkout (`/opt/drafted/current`) or equivalent repo root.
- `deploy/env/.env.prod` exists.
- Compose project name is `drafted` unless overridden.

## 1) Worker outage

```bash
bash tests/failure/kill_worker.sh 30
```

Stops the worker for 30 seconds, then starts it again.

## 2) Provider/network outage simulation

```bash
bash tests/failure/block_provider.sh 30
```

Disconnects worker container from compose network for 30 seconds, then reconnects.

## 3) Redis bounce

```bash
bash tests/failure/redis_bounce.sh 20
```

Stops Redis for 20 seconds, then starts it again.

## 4) DB pause

```bash
bash tests/failure/db_latency.sh 20
```

Pauses PostgreSQL container for 20 seconds and then unpauses.
