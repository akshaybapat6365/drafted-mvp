import fs from "node:fs";
import path from "node:path";

const webRoot = process.cwd();
const projectRoot = path.resolve(webRoot, "..");
const nextDir = path.join(webRoot, ".next");
const appServerDir = path.join(nextDir, "server", "app");
const budgetsPath = path.join(webRoot, "perf-budgets.json");
const reportsDir = path.join(projectRoot, "var", "reports");
const reportJson = path.join(reportsDir, "web-route-budgets.json");
const reportMd = path.join(reportsDir, "web-route-budgets.md");

if (!fs.existsSync(budgetsPath)) {
  console.error(`Missing budgets file: ${budgetsPath}`);
  process.exit(1);
}
if (!fs.existsSync(appServerDir)) {
  console.error("Missing .next/server/app directory. Run `npm run build` first.");
  process.exit(1);
}

const budgets = JSON.parse(fs.readFileSync(budgetsPath, "utf8"));

const routeMap = {
  "/": { html: "index.html", rsc: "index.rsc" },
  "/login": { html: "login.html", rsc: "login.rsc" },
  "/signup": { html: "signup.html", rsc: "signup.rsc" },
  "/app": { html: "app.html", rsc: "app.rsc" },
  "/app/drafts/new": { js: "app/drafts/new/page.js" },
  "/app/jobs/[jobId]": { js: "app/jobs/[jobId]/page.js" },
};

function sizeKb(filePath) {
  if (!filePath) return 0;
  const absolute = path.join(appServerDir, filePath);
  if (!fs.existsSync(absolute)) return 0;
  return Number((fs.statSync(absolute).size / 1024).toFixed(2));
}

function collectClientChunks(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && full.endsWith(".js")) {
        out.push(full);
      }
    }
  }
  return out;
}

const results = [];
const violations = [];
for (const [route, limits] of Object.entries(budgets.routes ?? {})) {
  const files = routeMap[route] ?? {};
  const htmlKb = sizeKb(files.html);
  const rscKb = sizeKb(files.rsc);
  const jsKb = sizeKb(files.js);
  const result = {
    route,
    html_kb: htmlKb,
    rsc_kb: rscKb,
    js_kb: jsKb,
    limits,
  };
  results.push(result);

  if (limits.html_kb_max != null && htmlKb > limits.html_kb_max) {
    violations.push(`${route} html ${htmlKb}KB > ${limits.html_kb_max}KB`);
  }
  if (limits.rsc_kb_max != null && rscKb > limits.rsc_kb_max) {
    violations.push(`${route} rsc ${rscKb}KB > ${limits.rsc_kb_max}KB`);
  }
  if (limits.js_kb_max != null && jsKb > limits.js_kb_max) {
    violations.push(`${route} js ${jsKb}KB > ${limits.js_kb_max}KB`);
  }
}

const clientChunkDir = path.join(nextDir, "static", "chunks");
const clientChunks = collectClientChunks(clientChunkDir);
const clientTotalKb = Number(
  (
    clientChunks.reduce((sum, chunkPath) => sum + fs.statSync(chunkPath).size, 0) / 1024
  ).toFixed(2),
);
if (budgets.client_total_kb_max != null && clientTotalKb > budgets.client_total_kb_max) {
  violations.push(
    `client_total ${clientTotalKb}KB > ${budgets.client_total_kb_max}KB`,
  );
}

fs.mkdirSync(reportsDir, { recursive: true });
const payload = {
  generated_at: new Date().toISOString(),
  client_total_kb: clientTotalKb,
  client_total_kb_max: budgets.client_total_kb_max ?? null,
  routes: results,
  violations,
};
fs.writeFileSync(reportJson, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

const md = [
  "# Web Route Budget Report",
  "",
  `- Generated: ${payload.generated_at}`,
  `- Client JS total: ${clientTotalKb}KB / max ${budgets.client_total_kb_max ?? "n/a"}KB`,
  "",
  "## Route metrics",
  "",
  "| Route | HTML KB | RSC KB | JS KB |",
  "| --- | ---: | ---: | ---: |",
  ...results.map(
    (entry) =>
      `| ${entry.route} | ${entry.html_kb} | ${entry.rsc_kb} | ${entry.js_kb} |`,
  ),
  "",
  "## Violations",
  ...(violations.length ? violations.map((line) => `- ${line}`) : ["- none"]),
  "",
];
fs.writeFileSync(reportMd, `${md.join("\n")}\n`, "utf8");

if (violations.length) {
  console.error("Web route budget violations detected:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Route budgets passed. Report: ${path.relative(projectRoot, reportMd)}`);
