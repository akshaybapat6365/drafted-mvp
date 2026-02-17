# VM Deployment Runbook (Ubuntu 24.04, Docker Compose, systemd, Caddy)

## What this deploy stack includes

- `deploy/compose/docker-compose.prod.yml` for `api`, `worker`, `web`, `postgres`, `redis`, `caddy`
- `deploy/systemd/drafted-prod.service` to lifecycle-manage compose through `systemd`
- `deploy/scripts/*` for bootstrap, deploy, rollback, and health-gating
- `deploy/env/.env.example` as the source template for production variables

## Prerequisites

- Ubuntu 24.04 VM with SSH access
- DNS A record pointing to VM IP for your chosen `DRAFTED_DOMAIN`
- Firewall open for `22`, `80`, `443`

## 1) Bootstrap VM (one time)

```bash
cd /opt/drafted/current
bash deploy/scripts/bootstrap_vm.sh
```

This installs Docker, enables Docker service, prepares `/opt/drafted/releases`, and sets firewall defaults.

## 2) Configure production env

From the release directory:

```bash
bash deploy/scripts/render_env.sh
```

Then edit `deploy/env/.env.prod` and replace all placeholder secrets:

- `JWT_SECRET`
- `POSTGRES_PASSWORD`
- `GEMINI_API_KEY`
- `DRAFTED_DOMAIN`

## 3) Deploy from local machine

Run from repo root:

```bash
cd /Users/akshaybapat/drafted-mvp
bash deploy/scripts/deploy.sh <ssh-host>
```

What deploy does:

1. Creates timestamped release under `/opt/drafted/releases/<timestamp>`
2. Rsyncs repo to that release
3. Renders env file if absent
4. Points `/opt/drafted/current` symlink to new release
5. Installs/reloads `drafted-prod.service`
6. Restarts service and runs health gate

## 4) Rollback

On the VM:

```bash
cd /opt/drafted/current
bash deploy/scripts/rollback.sh
```

This switches `current` symlink to previous release and restarts the systemd service.

## 5) Health and diagnostics

- API health JSON:

```bash
curl -s http://127.0.0.1:8000/api/v1/system/health | jq .
```

- systemd logs:

```bash
sudo journalctl -u drafted-prod.service -f
```

- compose state:

```bash
cd /opt/drafted/current
docker compose --project-name drafted --env-file deploy/env/.env.prod -f deploy/compose/docker-compose.prod.yml ps
```
