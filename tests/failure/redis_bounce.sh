#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/compose/docker-compose.prod.yml"
ENV_FILE="${ROOT_DIR}/deploy/env/.env.prod"
PROJECT_NAME="${PROJECT_NAME:-drafted}"
OUTAGE_SECONDS="${1:-15}"

docker compose --project-name "${PROJECT_NAME}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" stop redis
sleep "${OUTAGE_SECONDS}"
docker compose --project-name "${PROJECT_NAME}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d redis

echo "Redis bounce complete (${OUTAGE_SECONDS}s)."
