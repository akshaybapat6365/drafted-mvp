# Drafted MVP (Local Dev, API-First)

This repo is a working MVP of a Drafted-like workflow:

- Prompt + constraints -> `HouseSpec` (authoritative structured state)
- `HouseSpec` -> deterministic `PlanGraph` -> `plan.svg` artifact (local, non-AI rendering)
- Optional: exterior image via Gemini image models (online API; disabled if no API key)
- Job reliability controls: idempotency, retry classification, artifact checksums, export manifest

## Structure

- `api/`: FastAPI backend, SQLite persistence, in-process worker, artifact storage under `api/var/`
- `web/`: Next.js frontend (App Router) that talks to the backend via rewrites
- `deploy/`: VM automation (Docker Compose, Caddy, systemd, deploy scripts)
- `tests/load` + `tests/failure`: load and failure-injection assets for beta gating

## Run (Dev)

Single command (starts API + web dev server):

```bash
cd /Users/akshaybapat/drafted-mvp
bash scripts/dev.sh
```

1. API (port `8000`)

```bash
cd /Users/akshaybapat/drafted-mvp/api
/Users/akshaybapat/drafted-mvp/.venv/bin/uvicorn app.main:app --reload --port 8000
```

2. Web (port `3000`)

```bash
cd /Users/akshaybapat/drafted-mvp/web
npm run dev
```

Open `http://localhost:3000`.

System health endpoint:

```bash
curl -s http://127.0.0.1:8000/api/v1/system/health
```

## Configure Gemini (Optional)

By default, the API uses a mock provider (no external calls). To enable real model calls:

- Set `GEMINI_API_KEY` in `api/.env` (or your shell env)
- Optionally override:
  - `GEMINI_TEXT_MODEL` (default `gemini-2.5-flash`)
  - `GEMINI_IMAGE_MODEL_PREVIEW` (default `gemini-3-pro-image-preview`)

See `api/.env.example`.

## Production VM Deployment (Docker + systemd + Caddy)

Detailed runbook: `docs/deployment-vm.md`

Key commands:

```bash
# 1) Bootstrap VM once
cd /Users/akshaybapat/drafted-mvp
bash deploy/scripts/bootstrap_vm.sh

# 2) Render production env file (placeholder-safe)
bash deploy/scripts/render_env.sh

# 3) Deploy a release to remote VM
bash deploy/scripts/deploy.sh <ssh-host>
```

Rollback:

```bash
cd /opt/drafted/current
bash deploy/scripts/rollback.sh
```

Health gate:

```bash
curl -s http://127.0.0.1:8000/api/v1/system/health | jq .
```

## Tests

API tests:

```bash
cd /Users/akshaybapat/drafted-mvp/api
/Users/akshaybapat/drafted-mvp/.venv/bin/python -m pytest -q
```

Web checks:

```bash
cd /Users/akshaybapat/drafted-mvp/web
npm run lint
npm run build
```

Reliability and failure-injection plan:

- `docs/reliability-beta-gate.md`
- `tests/load/k6_jobs.js`
- `tests/load/k6_jobs_transient.js`
- `tests/failure/failure_injection.md`

Run full pre-beta validation locally (includes teardown):

```bash
cd /Users/akshaybapat/drafted-mvp
bash scripts/run_prebeta_validation.sh
```

CI gates:

- `.github/workflows/prebeta-gate.yml` (PR pre-beta gate)
- `.github/workflows/nightly-reliability.yml` (extended nightly reliability run)
