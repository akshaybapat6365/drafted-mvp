#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/deploy/compose/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/deploy/env/.env.prod}"
ENV_TEMPLATE="${ENV_TEMPLATE:-${ROOT_DIR}/deploy/env/.env.example}"
PROJECT_NAME="${PROJECT_NAME:-drafted-live-canary}"
REPORT_DIR="${ROOT_DIR}/var/reports/live-provider-canary"
API_HOST_PORT="${API_HOST_PORT:-18000}"
WEB_HOST_PORT="${WEB_HOST_PORT:-13000}"

mkdir -p "${REPORT_DIR}"

compose() {
  docker compose --project-name "${PROJECT_NAME}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

upsert_env() {
  local key="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp)"
  if [[ -f "${ENV_FILE}" ]]; then
    awk -v k="${key}" -v v="${value}" '
      BEGIN { done = 0 }
      $0 ~ ("^" k "=") {
        print k "=" v
        done = 1
        next
      }
      { print }
      END {
        if (!done) print k "=" v
      }
    ' "${ENV_FILE}" > "${tmp}"
    mv "${tmp}" "${ENV_FILE}"
  else
    printf "%s=%s\n" "${key}" "${value}" > "${ENV_FILE}"
  fi
}

cleanup() {
  compose ps > "${REPORT_DIR}/ps-final.txt" || true
  compose logs --no-color --since 30m > "${REPORT_DIR}/compose-logs-last30m.txt" || true
  compose down --volumes --remove-orphans > "${REPORT_DIR}/down.txt" || true
}
trap cleanup EXIT

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "GEMINI_API_KEY must be set for live provider canary."
  exit 1
fi

echo "[live-canary] preparing env file"
if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${ENV_TEMPLATE}" "${ENV_FILE}"
fi
upsert_env "DRAFTED_DOMAIN" "localhost"
upsert_env "API_BASE_URL" "http://127.0.0.1:${API_HOST_PORT}"
upsert_env "WEB_BASE_URL" "http://127.0.0.1:${WEB_HOST_PORT}"
upsert_env "CORS_ORIGINS" "http://localhost,http://127.0.0.1:${WEB_HOST_PORT}"
upsert_env "GEMINI_API_KEY" "${GEMINI_API_KEY}"
upsert_env "TRANSIENT_STUB_ENABLED" "false"
upsert_env "TRANSIENT_STUB_FAIL_FIRST_N" "0"
upsert_env "TRANSIENT_STUB_FAIL_EVERY_N" "0"
upsert_env "TRANSIENT_STUB_HTTP_CODE" "503"
upsert_env "TRANSIENT_STUB_SCOPE" "spec"

echo "[live-canary] starting compose services"
export API_HOST_PORT
export WEB_HOST_PORT
compose up -d --build postgres redis api worker | tee "${REPORT_DIR}/up.txt"

HEALTH_URL="http://127.0.0.1:${API_HOST_PORT}/api/v1/system/health" MAX_ATTEMPTS=80 SLEEP_SECONDS=2 \
  bash "${ROOT_DIR}/deploy/scripts/health_gate.sh" | tee "${REPORT_DIR}/health-gate.txt"

health_payload="$(curl -fsS "http://127.0.0.1:${API_HOST_PORT}/api/v1/system/health")"
printf '%s\n' "${health_payload}" > "${REPORT_DIR}/health.json"
provider_mode="$(printf '%s' "${health_payload}" | jq -r '.provider_mode // "unknown"')"
if [[ "${provider_mode}" != "gemini" ]]; then
  echo "Live canary expected provider_mode=gemini, got ${provider_mode}"
  exit 1
fi

suffix="$(date -u +%s)"
email="live-canary-${suffix}@example.com"
password="password123"

echo "[live-canary] signup"
signup_payload="$(curl -fsS -X POST "http://127.0.0.1:${API_HOST_PORT}/api/v1/auth/signup" \
  -H "content-type: application/json" \
  -d "{\"email\":\"${email}\",\"password\":\"${password}\"}")"
printf '%s\n' "${signup_payload}" > "${REPORT_DIR}/signup.json"
token="$(printf '%s' "${signup_payload}" | jq -r '.access_token // empty')"
if [[ -z "${token}" ]]; then
  echo "Signup did not return access token."
  exit 1
fi

echo "[live-canary] create session"
session_payload="$(curl -fsS -X POST "http://127.0.0.1:${API_HOST_PORT}/api/v1/sessions" \
  -H "content-type: application/json" \
  -H "authorization: Bearer ${token}" \
  -d "{\"title\":\"Live Canary ${suffix}\"}")"
printf '%s\n' "${session_payload}" > "${REPORT_DIR}/session.json"
session_id="$(printf '%s' "${session_payload}" | jq -r '.id // empty')"
if [[ -z "${session_id}" ]]; then
  echo "Session creation did not return id."
  exit 1
fi

echo "[live-canary] submit job"
job_submit_payload="$(curl -fsS -X POST "http://127.0.0.1:${API_HOST_PORT}/api/v1/jobs/sessions/${session_id}" \
  -H "content-type: application/json" \
  -H "authorization: Bearer ${token}" \
  -d '{"prompt":"Canary: 2 bed 2 bath compact contemporary home","bedrooms":2,"bathrooms":2,"style":"contemporary","want_exterior_image":false}')"
printf '%s\n' "${job_submit_payload}" > "${REPORT_DIR}/job-submit.json"
job_id="$(printf '%s' "${job_submit_payload}" | jq -r '.id // empty')"
if [[ -z "${job_id}" ]]; then
  echo "Job submission did not return id."
  exit 1
fi

echo "[live-canary] poll terminal status"
final_payload=""
for _ in $(seq 1 120); do
  final_payload="$(curl -fsS -X GET "http://127.0.0.1:${API_HOST_PORT}/api/v1/jobs/${job_id}" \
    -H "authorization: Bearer ${token}")"
  status="$(printf '%s' "${final_payload}" | jq -r '.status // "unknown"')"
  if [[ "${status}" == "succeeded" || "${status}" == "failed" ]]; then
    break
  fi
  sleep 2
done

printf '%s\n' "${final_payload}" > "${REPORT_DIR}/job-final.json"
final_status="$(printf '%s' "${final_payload}" | jq -r '.status // "unknown"')"
if [[ "${final_status}" != "succeeded" ]]; then
  echo "Live canary job terminal status=${final_status} (expected succeeded)"
  exit 1
fi

provider_meta_str="$(printf '%s' "${final_payload}" | jq -c '.provider_meta // {}')"
if [[ "${provider_meta_str}" != *"gemini"* ]]; then
  echo "Live canary expected provider_meta to include gemini, got ${provider_meta_str}"
  exit 1
fi

cat > "${REPORT_DIR}/canary-summary.md" <<EOF
# Live Provider Canary Report

- Generated: $(date -u +%FT%TZ)
- provider_mode: ${provider_mode}
- job_id: ${job_id}
- status: ${final_status}
- provider_meta: ${provider_meta_str}
EOF

echo "[live-canary] completed successfully"
