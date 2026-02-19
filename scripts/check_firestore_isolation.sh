#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RULES_FILE="${ROOT_DIR}/firestore.rules"
FUNCTIONS_FILE="${ROOT_DIR}/functions/src/index.ts"
REPORT_DIR="${ROOT_DIR}/var/reports/security"
REPORT_FILE="${REPORT_DIR}/firestore-isolation.txt"

mkdir -p "${REPORT_DIR}"
{
  echo "firestore isolation check: $(date -u +%FT%TZ)"
  echo "rules=${RULES_FILE}"
  echo "functions=${FUNCTIONS_FILE}"
} > "${REPORT_FILE}"

if ! grep -q "allow read, write: if false;" "${RULES_FILE}"; then
  echo "rules check failed: firestore direct access is not denied" | tee -a "${REPORT_FILE}"
  exit 1
fi

required_checks=(
  "assertSessionOwner"
  "assertJobOwner"
  ".where(\"uid\", \"==\", uid)"
)

for token in "${required_checks[@]}"; do
  if ! grep -q "${token}" "${FUNCTIONS_FILE}"; then
    echo "functions check failed: missing ${token}" | tee -a "${REPORT_FILE}"
    exit 1
  fi
done

echo "firestore isolation check passed" | tee -a "${REPORT_FILE}"
