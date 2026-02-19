#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/deploy/compose/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/deploy/env/.env.prod}"
ENV_TEMPLATE="${ENV_TEMPLATE:-${ROOT_DIR}/deploy/env/.env.example}"
PROJECT_NAME="${PROJECT_NAME:-drafted}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

BASELINE_DURATION="${BASELINE_DURATION:-3m}"
BASELINE_VUS="${BASELINE_VUS:-8}"
TRANSIENT_DURATION="${TRANSIENT_DURATION:-4m}"
TRANSIENT_VUS="${TRANSIENT_VUS:-8}"
TRANSIENT_FAIL_FIRST_N="${TRANSIENT_FAIL_FIRST_N:-300}"
TRANSIENT_FAIL_EVERY_N="${TRANSIENT_FAIL_EVERY_N:-0}"
TRANSIENT_HTTP_CODE="${TRANSIENT_HTTP_CODE:-503}"
RETRY_ADHERENCE_MIN="${RETRY_ADHERENCE_MIN:-99.5}"

REPORT_ROOT="${ROOT_DIR}/var/reports"
COMPOSE_REPORT_DIR="${REPORT_ROOT}/compose-dry-run"
LOAD_REPORT_DIR="${REPORT_ROOT}/load-run"
FAILURE_REPORT_DIR="${REPORT_ROOT}/failure-injection"
TRANSIENT_REPORT_DIR="${REPORT_ROOT}/transient-run"

mkdir -p "${COMPOSE_REPORT_DIR}" "${LOAD_REPORT_DIR}" "${FAILURE_REPORT_DIR}" "${TRANSIENT_REPORT_DIR}"

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
  compose ps > "${COMPOSE_REPORT_DIR}/ps-final.txt" || true
  compose logs --no-color --since 30m > "${COMPOSE_REPORT_DIR}/compose-logs-last30m.txt" || true
  compose down --volumes --remove-orphans > "${COMPOSE_REPORT_DIR}/down.txt" || true
}
trap cleanup EXIT

echo "[prebeta] preparing env file"
if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${ENV_TEMPLATE}" "${ENV_FILE}"
fi
upsert_env "DRAFTED_DOMAIN" "localhost"
upsert_env "API_BASE_URL" "http://localhost"
upsert_env "WEB_BASE_URL" "http://localhost"
upsert_env "CORS_ORIGINS" "http://localhost,http://127.0.0.1:3000"
upsert_env "GEMINI_API_KEY" ""
upsert_env "TRANSIENT_STUB_ENABLED" "false"
upsert_env "TRANSIENT_STUB_FAIL_FIRST_N" "0"
upsert_env "TRANSIENT_STUB_FAIL_EVERY_N" "0"
upsert_env "TRANSIENT_STUB_HTTP_CODE" "503"
upsert_env "TRANSIENT_STUB_SCOPE" "spec"

echo "[prebeta] compose up"
compose up -d --build | tee "${COMPOSE_REPORT_DIR}/up.txt"
HEALTH_URL="http://127.0.0.1:8000/api/v1/system/health" MAX_ATTEMPTS=80 SLEEP_SECONDS=2 \
  bash "${ROOT_DIR}/deploy/scripts/health_gate.sh" | tee "${COMPOSE_REPORT_DIR}/health-gate.txt"
curl -fsS "http://127.0.0.1:8000/api/v1/system/health" > "${COMPOSE_REPORT_DIR}/health-initial.json"

echo "[prebeta] api tests"
(
  cd "${ROOT_DIR}/api"
  "${PYTHON_BIN}" -m pytest -q
) | tee "${REPORT_ROOT}/api-tests.txt"

echo "[prebeta] baseline load run + failure injection sequence"
(
  BASE_URL="http://127.0.0.1:8000" DURATION="${BASELINE_DURATION}" VUS="${BASELINE_VUS}" \
    k6 run "${ROOT_DIR}/tests/load/k6_jobs.js"
) | tee "${LOAD_REPORT_DIR}/k6-baseline.txt" &
K6_BASE_PID=$!

(
  set -euo pipefail
  echo "$(date -u +%FT%TZ) begin failure-injection"
  sleep 20
  echo "$(date -u +%FT%TZ) kill_worker"
  bash "${ROOT_DIR}/tests/failure/kill_worker.sh" 15
  sleep 20
  echo "$(date -u +%FT%TZ) block_provider"
  bash "${ROOT_DIR}/tests/failure/block_provider.sh" 15
  sleep 20
  echo "$(date -u +%FT%TZ) redis_bounce"
  bash "${ROOT_DIR}/tests/failure/redis_bounce.sh" 12
  sleep 20
  echo "$(date -u +%FT%TZ) db_latency"
  bash "${ROOT_DIR}/tests/failure/db_latency.sh" 12
  echo "$(date -u +%FT%TZ) end failure-injection"
) | tee "${FAILURE_REPORT_DIR}/sequence.txt" &
INJECT_PID=$!

(
  for _ in $(seq 1 10); do
    ts="$(date -u +%Y%m%dT%H%M%SZ)"
    curl -fsS "http://127.0.0.1:8000/api/v1/system/health" > "${FAILURE_REPORT_DIR}/health-${ts}.json"
    sleep 20
  done
) &
HEALTH_LOOP_PID=$!

wait "${INJECT_PID}"
wait "${HEALTH_LOOP_PID}"
wait "${K6_BASE_PID}"
curl -fsS "http://127.0.0.1:8000/api/v1/system/health" > "${FAILURE_REPORT_DIR}/health-post-faults.json"

echo "[prebeta] transient stub stress run"
upsert_env "TRANSIENT_STUB_ENABLED" "true"
upsert_env "TRANSIENT_STUB_FAIL_FIRST_N" "${TRANSIENT_FAIL_FIRST_N}"
upsert_env "TRANSIENT_STUB_FAIL_EVERY_N" "${TRANSIENT_FAIL_EVERY_N}"
upsert_env "TRANSIENT_STUB_HTTP_CODE" "${TRANSIENT_HTTP_CODE}"
upsert_env "TRANSIENT_STUB_SCOPE" "spec"
compose up -d --force-recreate api worker | tee "${TRANSIENT_REPORT_DIR}/api-worker-recreate.txt"
HEALTH_URL="http://127.0.0.1:8000/api/v1/system/health" MAX_ATTEMPTS=80 SLEEP_SECONDS=2 \
  bash "${ROOT_DIR}/deploy/scripts/health_gate.sh" | tee "${TRANSIENT_REPORT_DIR}/health-gate-after-recreate.txt"
curl -fsS "http://127.0.0.1:8000/api/v1/system/health" > "${TRANSIENT_REPORT_DIR}/health-after-recreate.json"

(
  BASE_URL="http://127.0.0.1:8000" DURATION="${TRANSIENT_DURATION}" VUS="${TRANSIENT_VUS}" \
    k6 run "${ROOT_DIR}/tests/load/k6_jobs_transient.js"
) | tee "${TRANSIENT_REPORT_DIR}/k6-transient.txt"

bash "${ROOT_DIR}/tests/reliability/collect_retry_metrics.sh" \
  | tee "${TRANSIENT_REPORT_DIR}/retry-metrics-output.txt"
RETRY_ADHERENCE_MIN="${RETRY_ADHERENCE_MIN}" \
  bash "${ROOT_DIR}/tests/reliability/evaluate_retry_adherence.sh" \
  | tee "${TRANSIENT_REPORT_DIR}/retry-evaluation-output.txt"

echo "[prebeta] final report"
jobs_total="$(jq -r '.jobs_total' "${REPORT_ROOT}/retry-adherence.json")"
jobs_succeeded="$(jq -r '.jobs_succeeded' "${REPORT_ROOT}/retry-adherence.json")"
jobs_failed="$(jq -r '.jobs_failed' "${REPORT_ROOT}/retry-adherence.json")"
retry_adherence_pct="$(jq -r '.retry_adherence_pct' "${REPORT_ROOT}/retry-adherence.json")"
lost_jobs="$(jq -r '.lost_jobs' "${REPORT_ROOT}/retry-adherence.json")"
dup_terminal="$(jq -r '.duplicate_terminal_idempotency' "${REPORT_ROOT}/retry-adherence.json")"

cat > "${REPORT_ROOT}/beta-gate-report.md" <<EOF
# Beta Gate Report

- Generated: $(date -u +%FT%TZ)
- Baseline load duration: ${BASELINE_DURATION}
- Transient stress duration: ${TRANSIENT_DURATION}

## Baseline and failure-injection evidence

- \`var/reports/load-run/k6-baseline.txt\`
- \`var/reports/failure-injection/sequence.txt\`
- \`var/reports/failure-injection/health-*.json\`
- \`var/reports/failure-injection/health-post-faults.json\`

## Transient retry-adherence metrics

- jobs_total: ${jobs_total}
- jobs_succeeded: ${jobs_succeeded}
- jobs_failed: ${jobs_failed}
- retry_adherence_pct: ${retry_adherence_pct}
- lost_jobs: ${lost_jobs}
- duplicate_terminal_idempotency: ${dup_terminal}

## Evaluation

See:

- \`var/reports/retry-adherence.json\`
- \`var/reports/retry-adherence.md\`
EOF

echo "[prebeta] validation flow completed"
