#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/compose/docker-compose.prod.yml"
ENV_FILE="${ROOT_DIR}/deploy/env/.env.prod"
PROJECT_NAME="${PROJECT_NAME:-drafted}"
OUTAGE_SECONDS="${1:-15}"

DB_CID="$(docker compose --project-name "${PROJECT_NAME}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps -q postgres)"
if [[ -z "${DB_CID}" ]]; then
  echo "Could not find postgres container"
  exit 1
fi

docker pause "${DB_CID}"
sleep "${OUTAGE_SECONDS}"
docker unpause "${DB_CID}"

echo "Postgres pause/unpause complete (${OUTAGE_SECONDS}s)."
