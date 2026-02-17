#!/usr/bin/env bash
set -euo pipefail

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8000/api/v1/system/health}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-40}"
SLEEP_SECONDS="${SLEEP_SECONDS:-3}"

attempt=1
while [[ "${attempt}" -le "${MAX_ATTEMPTS}" ]]; do
  payload="$(curl -fsS "${HEALTH_URL}" || true)"
  if [[ -n "${payload}" ]]; then
    ok="$(printf '%s' "${payload}" | jq -r '.ok // false')"
    db_status="$(printf '%s' "${payload}" | jq -r '.database.status // "error"')"
    queue_status="$(printf '%s' "${payload}" | jq -r '.queue_backend.status // "error"')"
    if [[ "${ok}" == "true" && "${db_status}" == "ok" && "${queue_status}" == "ok" ]]; then
      echo "Health gate passed on attempt ${attempt}"
      exit 0
    fi
  fi
  sleep "${SLEEP_SECONDS}"
  attempt=$((attempt + 1))
done

echo "Health gate failed after ${MAX_ATTEMPTS} attempts: ${HEALTH_URL}"
exit 1
