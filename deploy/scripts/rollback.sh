#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/drafted}"
CURRENT_LINK="${APP_ROOT}/current"
RELEASES_DIR="${APP_ROOT}/releases"

if [[ ! -L "${CURRENT_LINK}" ]]; then
  echo "Current symlink not found at ${CURRENT_LINK}"
  exit 1
fi

CURRENT_TARGET="$(readlink -f "${CURRENT_LINK}")"
PREV_TARGET=""

while IFS= read -r release; do
  resolved="$(readlink -f "${release}")"
  if [[ "${resolved}" != "${CURRENT_TARGET}" ]]; then
    PREV_TARGET="${resolved}"
    break
  fi
done < <(find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d | sort -r)

if [[ -z "${PREV_TARGET}" ]]; then
  echo "No previous release found"
  exit 1
fi

ln -sfn "${PREV_TARGET}" "${CURRENT_LINK}"
sudo systemctl restart drafted-prod.service
bash "${CURRENT_LINK}/deploy/scripts/health_gate.sh"

echo "Rollback complete. Active release: ${PREV_TARGET}"
