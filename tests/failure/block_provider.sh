#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/compose/docker-compose.prod.yml"
ENV_FILE="${ROOT_DIR}/deploy/env/.env.prod"
PROJECT_NAME="${PROJECT_NAME:-drafted}"
OUTAGE_SECONDS="${1:-20}"
NETWORK_NAME="${NETWORK_NAME:-${PROJECT_NAME}_default}"

WORKER_CID="$(docker compose --project-name "${PROJECT_NAME}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps -q worker)"
if [[ -z "${WORKER_CID}" ]]; then
  echo "Could not find worker container"
  exit 1
fi

docker network disconnect "${NETWORK_NAME}" "${WORKER_CID}" || true
sleep "${OUTAGE_SECONDS}"
docker network connect "${NETWORK_NAME}" "${WORKER_CID}" || true

echo "Worker network outage complete (${OUTAGE_SECONDS}s)."
