# Drafted MVP (Firebase-Native Backend)

This repo is a working MVP of a Drafted-like workflow with Firebase-native backend services:

- Prompt + constraints -> `HouseSpec` (authoritative structured state)
- `HouseSpec` -> deterministic `PlanGraph` -> `plan.svg` artifact (local, non-AI rendering)
- Optional: exterior image via Gemini image models (online API; disabled if no API key)
- Job reliability controls: idempotency, retry classification, artifact checksums, export manifest

## Structure

- `functions/`: Firebase Cloud Functions backend (HTTP API + async job worker trigger)
- `api/`: legacy FastAPI backend (kept for reference/migration support)
- `web/`: Next.js frontend (App Router) that talks to the backend via rewrites
- `firebase.json` + rules files: Hosting/Functions/Firestore/Storage project config
- `deploy/`: VM automation (Docker Compose, Caddy, systemd, deploy scripts)
- `tests/load` + `tests/failure`: load and failure-injection assets for beta gating

## Firebase-native setup

1. Configure Firebase project:

```bash
cd /Users/akshaybapat/drafted-mvp
cp .firebaserc .firebaserc.local
# Edit .firebaserc with your real project ID
```

2. Install web and functions dependencies:

```bash
cd /Users/akshaybapat/drafted-mvp/web && npm install
cd /Users/akshaybapat/drafted-mvp/functions && npm install
```

3. Build/deploy functions and hosting:

```bash
cd /Users/akshaybapat/drafted-mvp/functions
npm run build
firebase deploy --only functions,hosting,firestore,storage
```

4. Set required function environment secrets/vars:

- `GEMINI_API_KEY`
- `GEMINI_TEXT_MODEL` (default `gemini-2.5-flash`)
- `GEMINI_IMAGE_MODEL_PREVIEW` (default `gemini-3-pro-image-preview`)
- `GCS_BUCKET` (optional if default bucket is configured)

Detailed runbook: `docs/firebase-native-deployment.md`

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
