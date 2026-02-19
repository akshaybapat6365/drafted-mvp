import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8000";
const DURATION = __ENV.DURATION || "5m";
const VUS = Number(__ENV.VUS || 10);

export const options = {
  scenarios: {
    job_ingest: {
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<2000"],
  },
};

function uniqueSuffix() {
  return `${Date.now()}-${__VU}-${__ITER}`;
}

export function setup() {
  const suffix = `${Date.now()}-setup`;
  const email = `k6-${suffix}@example.com`;
  const password = "password123";

  const signup = http.post(
    `${BASE_URL}/api/v1/auth/signup`,
    JSON.stringify({ email, password }),
    { headers: { "content-type": "application/json" } },
  );
  check(signup, { "signup ok": (r) => r.status === 200 });
  const token = signup.json("access_token");
  const authHeaders = {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  };

  const session = http.post(
    `${BASE_URL}/api/v1/sessions`,
    JSON.stringify({ title: `Load-${suffix}` }),
    { headers: authHeaders },
  );
  check(session, { "session create ok": (r) => r.status === 200 });

  const sessionId = session.json("id");
  return { sessionId, authHeaders };
}

export default function (data) {
  const suffix = uniqueSuffix();
  const payload = {
    prompt: "3 bed 2 bath contemporary with open kitchen",
    bedrooms: 3,
    bathrooms: 2,
    style: "contemporary",
    want_exterior_image: false,
    idempotency_key: `k6-${suffix}`,
  };

  const submit = http.post(
    `${BASE_URL}/api/v1/jobs/sessions/${data.sessionId}`,
    JSON.stringify(payload),
    { headers: data.authHeaders },
  );

  check(submit, { "job submit ok": (r) => r.status === 200 });
  sleep(0.2);

  const jobId = submit.json("id");
  if (jobId) {
    const status = http.get(`${BASE_URL}/api/v1/jobs/${jobId}`, { headers: data.authHeaders });
    check(status, { "job status readable": (r) => r.status === 200 });
  }
}
