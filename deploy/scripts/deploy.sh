#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <ssh-host>"
  exit 1
fi

HOST="$1"
APP_ROOT="${APP_ROOT:-/opt/drafted}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE="$(date -u +%Y%m%d%H%M%S)"
REMOTE_RELEASE="${APP_ROOT}/releases/${RELEASE}"

ssh "${HOST}" "mkdir -p '${REMOTE_RELEASE}'"

rsync -az --delete \
  --exclude ".git" \
  --exclude "web/node_modules" \
  --exclude "web/.next" \
  --exclude "api/.pytest_cache" \
  --exclude "var" \
  "${ROOT_DIR}/" "${HOST}:${REMOTE_RELEASE}/"

ssh "${HOST}" "cd '${REMOTE_RELEASE}' && bash deploy/scripts/render_env.sh"
ssh "${HOST}" "ln -sfn '${REMOTE_RELEASE}' '${APP_ROOT}/current'"
ssh "${HOST}" "sudo cp '${APP_ROOT}/current/deploy/systemd/drafted-prod.service' /etc/systemd/system/drafted-prod.service"
ssh "${HOST}" "sudo systemctl daemon-reload && sudo systemctl enable drafted-prod.service && sudo systemctl restart drafted-prod.service"
ssh "${HOST}" "bash '${APP_ROOT}/current/deploy/scripts/health_gate.sh'"

echo "Deploy complete. Active release: ${REMOTE_RELEASE}"
