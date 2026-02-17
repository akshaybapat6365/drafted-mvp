import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8000";
const DURATION = __ENV.DURATION || "5m";
const VUS = Number(__ENV.VUS || 10);

export const options = {
  scenarios: {
    transient_retry_ingest: {
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.03"],
    http_req_duration: ["p(95)<3000"],
  },
  systemTags: ["status", "method", "name", "scenario", "expected_response"],
};

function uniqueSuffix() {
  return `${Date.now()}-${__VU}-${__ITER}`;
}

export function setup() {
  const suffix = `${Date.now()}-setup`;
  const email = `k6-transient-${suffix}@example.com`;
  const password = "password123";

  const signup = http.post(
    `${BASE_URL}/api/v1/auth/signup`,
    JSON.stringify({ email, password }),
    {
      headers: { "content-type": "application/json" },
      tags: { name: "POST /api/v1/auth/signup" },
    },
  );
  check(signup, { "signup ok": (r) => r.status === 200 });

  const token = signup.json("access_token");
  const authHeaders = {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  };

  const session = http.post(
    `${BASE_URL}/api/v1/sessions`,
    JSON.stringify({ title: `LoadTransient-${suffix}` }),
    {
      headers: authHeaders,
      tags: { name: "POST /api/v1/sessions" },
    },
  );
  check(session, { "session create ok": (r) => r.status === 200 });

  const sessionId = session.json("id");
  return { sessionId, authHeaders };
}

export default function (data) {
  const suffix = uniqueSuffix();
  const payload = {
    prompt: "4 bed 3 bath contemporary with open kitchen and office",
    bedrooms: 4,
    bathrooms: 3,
    style: "contemporary",
    want_exterior_image: false,
    idempotency_key: `k6-transient-${suffix}`,
  };

  const submit = http.post(
    `${BASE_URL}/api/v1/jobs/sessions/${data.sessionId}`,
    JSON.stringify(payload),
    {
      headers: data.authHeaders,
      tags: { name: "POST /api/v1/jobs/sessions/:id" },
    },
  );
  check(submit, { "job submit ok": (r) => r.status === 200 });

  const jobId = submit.json("id");
  if (jobId) {
    const statusUrl = http.url`${BASE_URL}/api/v1/jobs/${jobId}`;
    const status = http.get(statusUrl, {
      headers: data.authHeaders,
      tags: { name: "GET /api/v1/jobs/:id" },
    });
    check(status, { "job status readable": (r) => r.status === 200 });
  }

  sleep(0.15);
}
