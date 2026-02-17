#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"

echo "Starting API on :${API_PORT}"
(
  cd "${ROOT_DIR}/api"
  "${ROOT_DIR}/.venv/bin/uvicorn" app.main:app --reload --port "${API_PORT}"
) &
API_PID="$!"

cleanup() {
  echo ""
  echo "Stopping API (pid ${API_PID})"
  kill "${API_PID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Starting web on :${WEB_PORT}"
cd "${ROOT_DIR}/web"
PORT="${WEB_PORT}" npm run dev

