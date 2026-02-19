#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_TEMPLATE="${ENV_TEMPLATE:-${ROOT_DIR}/deploy/env/.env.example}"
ENV_PROD="${ENV_PROD:-${ROOT_DIR}/deploy/env/.env.prod}"
REPORT_DIR="${ROOT_DIR}/var/reports/config"
REPORT_FILE="${REPORT_DIR}/firebase-env-parity.txt"
FIREBASE_PROD_REQUIRED="${FIREBASE_PROD_REQUIRED:-false}"

mkdir -p "${REPORT_DIR}"

required_keys=(
  "NEXT_PUBLIC_FIREBASE_API_KEY"
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
  "NEXT_PUBLIC_FIREBASE_APP_ID"
)

check_file() {
  local file="$1"
  local fail_on_missing="$2"
  local missing=0
  for key in "${required_keys[@]}"; do
    if ! grep -q "^${key}=" "${file}"; then
      if [[ "${fail_on_missing}" == "true" ]]; then
        echo "missing ${key} in ${file}" | tee -a "${REPORT_FILE}"
      else
        echo "warning: missing ${key} in ${file}" | tee -a "${REPORT_FILE}"
      fi
      missing=1
    fi
  done
  return "${missing}"
}

echo "firebase env parity check: $(date -u +%FT%TZ)" > "${REPORT_FILE}"
echo "template=${ENV_TEMPLATE}" >> "${REPORT_FILE}"
echo "prod=${ENV_PROD}" >> "${REPORT_FILE}"

if [[ ! -f "${ENV_TEMPLATE}" ]]; then
  echo "template env file not found: ${ENV_TEMPLATE}" | tee -a "${REPORT_FILE}"
  exit 1
fi
if [[ ! -f "${ENV_PROD}" ]]; then
  echo "prod env file not found: ${ENV_PROD}" | tee -a "${REPORT_FILE}"
  exit 1
fi

template_missing=0
prod_missing=0
check_file "${ENV_TEMPLATE}" "true" || template_missing=1
check_file "${ENV_PROD}" "${FIREBASE_PROD_REQUIRED}" || prod_missing=1

if [[ "${template_missing}" -eq 1 || ("${FIREBASE_PROD_REQUIRED}" == "true" && "${prod_missing}" -eq 1) ]]; then
  echo "firebase env parity failed" | tee -a "${REPORT_FILE}"
  exit 1
fi

echo "firebase env parity passed (prod_required=${FIREBASE_PROD_REQUIRED})" | tee -a "${REPORT_FILE}"
