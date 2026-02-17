#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
METRICS_JSON="${METRICS_JSON:-${ROOT_DIR}/var/reports/retry-adherence.json}"
REPORT_MD="${REPORT_MD:-${ROOT_DIR}/var/reports/retry-adherence.md}"
RETRY_ADHERENCE_MIN="${RETRY_ADHERENCE_MIN:-99.5}"

if [[ ! -f "${METRICS_JSON}" ]]; then
  echo "Metrics file not found: ${METRICS_JSON}" >&2
  exit 1
fi

retry_adherence_pct="$(jq -r '.retry_adherence_pct' "${METRICS_JSON}")"
retryable_total="$(jq -r '.retryable_total' "${METRICS_JSON}")"
lost_jobs="$(jq -r '.lost_jobs' "${METRICS_JSON}")"
duplicate_terminal_idempotency="$(jq -r '.duplicate_terminal_idempotency' "${METRICS_JSON}")"
jobs_total="$(jq -r '.jobs_total' "${METRICS_JSON}")"
jobs_succeeded="$(jq -r '.jobs_succeeded' "${METRICS_JSON}")"
jobs_failed="$(jq -r '.jobs_failed' "${METRICS_JSON}")"

retry_gate="$(awk -v pct="${retry_adherence_pct}" -v min="${RETRY_ADHERENCE_MIN}" 'BEGIN { if (pct >= min) print "pass"; else print "fail" }')"
retryable_gate="pass"
if [[ "${retryable_total}" -eq 0 ]]; then
  retryable_gate="fail"
fi
lost_gate="pass"
if [[ "${lost_jobs}" -ne 0 ]]; then
  lost_gate="fail"
fi
dup_gate="pass"
if [[ "${duplicate_terminal_idempotency}" -ne 0 ]]; then
  dup_gate="fail"
fi

overall="pass"
if [[ "${retry_gate}" != "pass" || "${retryable_gate}" != "pass" || "${lost_gate}" != "pass" || "${dup_gate}" != "pass" ]]; then
  overall="fail"
fi

mkdir -p "$(dirname "${REPORT_MD}")"
cat > "${REPORT_MD}" <<EOF
# Retry Adherence Evaluation

- Generated: $(date -u +%FT%TZ)
- Source metrics: \`${METRICS_JSON}\`

## Inputs

- jobs_total: ${jobs_total}
- jobs_succeeded: ${jobs_succeeded}
- jobs_failed: ${jobs_failed}
- retryable_total: ${retryable_total}
- retry_adherence_pct: ${retry_adherence_pct}
- lost_jobs: ${lost_jobs}
- duplicate_terminal_idempotency: ${duplicate_terminal_idempotency}

## Gates

1. Retry adherence >= ${RETRY_ADHERENCE_MIN}: **${retry_gate}**
2. Retryable sample size > 0: **${retryable_gate}**
3. Lost jobs == 0: **${lost_gate}**
4. Duplicate terminal idempotency == 0: **${dup_gate}**

## Overall

**${overall}**
EOF

cat "${REPORT_MD}"

if [[ "${overall}" != "pass" ]]; then
  exit 1
fi
