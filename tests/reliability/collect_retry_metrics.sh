#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/deploy/compose/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/deploy/env/.env.prod}"
PROJECT_NAME="${PROJECT_NAME:-drafted}"
REPORT_JSON="${REPORT_JSON:-${ROOT_DIR}/var/reports/retry-adherence.json}"
SESSION_PATTERN="${SESSION_PATTERN:-LoadTransient-%}"
POSTGRES_USER="${POSTGRES_USER:-drafted}"
POSTGRES_DB="${POSTGRES_DB:-drafted}"

mkdir -p "$(dirname "${REPORT_JSON}")"

compose() {
  docker compose --project-name "${PROJECT_NAME}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

sql() {
  local query="$1"
  compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -At -c "${query}"
}

SESSION_SQL="SELECT id FROM sessions WHERE title LIKE '${SESSION_PATTERN}'"

sessions_total="$(sql "WITH s AS (${SESSION_SQL}) SELECT count(*) FROM s;")"
jobs_total="$(sql "WITH s AS (${SESSION_SQL}) SELECT count(*) FROM jobs WHERE session_id IN (SELECT id FROM s);")"
jobs_succeeded="$(sql "WITH s AS (${SESSION_SQL}) SELECT count(*) FROM jobs WHERE session_id IN (SELECT id FROM s) AND status='succeeded';")"
jobs_failed="$(sql "WITH s AS (${SESSION_SQL}) SELECT count(*) FROM jobs WHERE session_id IN (SELECT id FROM s) AND status='failed';")"
jobs_running="$(sql "WITH s AS (${SESSION_SQL}) SELECT count(*) FROM jobs WHERE session_id IN (SELECT id FROM s) AND status='running';")"
jobs_queued="$(sql "WITH s AS (${SESSION_SQL}) SELECT count(*) FROM jobs WHERE session_id IN (SELECT id FROM s) AND status='queued';")"
retried_jobs="$(sql "WITH s AS (${SESSION_SQL}) SELECT count(*) FROM jobs WHERE session_id IN (SELECT id FROM s) AND retry_count > 0;")"
provider_transient_failures="$(sql "WITH s AS (${SESSION_SQL}) SELECT count(*) FROM jobs WHERE session_id IN (SELECT id FROM s) AND failure_code='provider_transient';")"
provider_permanent_failures="$(sql "WITH s AS (${SESSION_SQL}) SELECT count(*) FROM jobs WHERE session_id IN (SELECT id FROM s) AND failure_code='provider_permanent';")"
validation_failures="$(sql "WITH s AS (${SESSION_SQL}) SELECT count(*) FROM jobs WHERE session_id IN (SELECT id FROM s) AND failure_code='validation';")"
system_failures="$(sql "WITH s AS (${SESSION_SQL}) SELECT count(*) FROM jobs WHERE session_id IN (SELECT id FROM s) AND failure_code='system';")"
duplicate_terminal_idempotency="$(sql "WITH s AS (${SESSION_SQL}) SELECT count(*) FROM (SELECT idempotency_key FROM jobs WHERE session_id IN (SELECT id FROM s) AND idempotency_key IS NOT NULL AND status IN ('succeeded','failed') GROUP BY idempotency_key HAVING count(*)>1) t;")"
retryable_total="$(sql "WITH s AS (${SESSION_SQL}) SELECT count(*) FROM jobs WHERE session_id IN (SELECT id FROM s) AND (retry_count > 0 OR failure_code='provider_transient');")"
retry_adhered="$(sql "WITH s AS (${SESSION_SQL}) SELECT count(*) FROM jobs WHERE session_id IN (SELECT id FROM s) AND ((status='succeeded' AND retry_count > 0) OR (status='failed' AND failure_code='provider_transient'));")"

terminal_jobs=$((jobs_succeeded + jobs_failed))
lost_jobs=$((jobs_total - terminal_jobs))
if [[ "${lost_jobs}" -lt 0 ]]; then
  lost_jobs=0
fi

if [[ "${retryable_total}" -gt 0 ]]; then
  retry_adherence_pct="$(awk -v num="${retry_adhered}" -v den="${retryable_total}" 'BEGIN { printf "%.3f", (num/den)*100 }')"
else
  retry_adherence_pct="0.000"
fi

jq -n \
  --arg generated_at "$(date -u +%FT%TZ)" \
  --arg session_pattern "${SESSION_PATTERN}" \
  --argjson sessions_total "${sessions_total}" \
  --argjson jobs_total "${jobs_total}" \
  --argjson jobs_succeeded "${jobs_succeeded}" \
  --argjson jobs_failed "${jobs_failed}" \
  --argjson jobs_running "${jobs_running}" \
  --argjson jobs_queued "${jobs_queued}" \
  --argjson retried_jobs "${retried_jobs}" \
  --argjson provider_transient_failures "${provider_transient_failures}" \
  --argjson provider_permanent_failures "${provider_permanent_failures}" \
  --argjson validation_failures "${validation_failures}" \
  --argjson system_failures "${system_failures}" \
  --argjson duplicate_terminal_idempotency "${duplicate_terminal_idempotency}" \
  --argjson retryable_total "${retryable_total}" \
  --argjson retry_adhered "${retry_adhered}" \
  --argjson terminal_jobs "${terminal_jobs}" \
  --argjson lost_jobs "${lost_jobs}" \
  --argjson retry_adherence_pct "${retry_adherence_pct}" \
  '{
    generated_at: $generated_at,
    session_pattern: $session_pattern,
    sessions_total: $sessions_total,
    jobs_total: $jobs_total,
    jobs_succeeded: $jobs_succeeded,
    jobs_failed: $jobs_failed,
    jobs_running: $jobs_running,
    jobs_queued: $jobs_queued,
    terminal_jobs: $terminal_jobs,
    lost_jobs: $lost_jobs,
    retried_jobs: $retried_jobs,
    provider_transient_failures: $provider_transient_failures,
    provider_permanent_failures: $provider_permanent_failures,
    validation_failures: $validation_failures,
    system_failures: $system_failures,
    duplicate_terminal_idempotency: $duplicate_terminal_idempotency,
    retryable_total: $retryable_total,
    retry_adhered: $retry_adhered,
    retry_adherence_pct: $retry_adherence_pct
  }' > "${REPORT_JSON}"

cat "${REPORT_JSON}"
