import fs from "node:fs";
import path from "node:path";

const webRoot = process.cwd();
const projectRoot = path.resolve(webRoot, "..");
const reportsDir = path.join(projectRoot, "var", "reports");
const baselinePath = path.join(reportsDir, "web-bundle-baseline.json");
const reportPath = path.join(reportsDir, "web-bundle-report.md");

function collectFiles(startDir, predicate) {
  if (!fs.existsSync(startDir)) return [];
  const stack = [startDir];
  const out = [];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && predicate(full)) {
        out.push(full);
      }
    }
  }
  return out;
}

function bytes(paths) {
  return paths.reduce((sum, filePath) => sum + fs.statSync(filePath).size, 0);
}

function kb(value) {
  return Number((value / 1024).toFixed(2));
}

const clientJs = collectFiles(path.join(webRoot, ".next", "static", "chunks"), (f) =>
  f.endsWith(".js"),
);
const serverApp = collectFiles(path.join(webRoot, ".next", "server", "app"), (f) =>
  f.endsWith(".js") || f.endsWith(".rsc") || f.endsWith(".html"),
);

const current = {
  generated_at: new Date().toISOString(),
  client_js_bytes: bytes(clientJs),
  server_app_bytes: bytes(serverApp),
};

fs.mkdirSync(reportsDir, { recursive: true });

let baseline = null;
if (fs.existsSync(baselinePath)) {
  baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
} else {
  fs.writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  baseline = current;
}

const deltaClient = current.client_js_bytes - baseline.client_js_bytes;
const deltaServer = current.server_app_bytes - baseline.server_app_bytes;
const lines = [
  "# Web Bundle Delta Report",
  "",
  `- Generated: ${current.generated_at}`,
  "",
  "| Metric | Baseline KB | Current KB | Delta KB |",
  "| --- | ---: | ---: | ---: |",
  `| Client JS | ${kb(baseline.client_js_bytes)} | ${kb(current.client_js_bytes)} | ${kb(deltaClient)} |`,
  `| Server app | ${kb(baseline.server_app_bytes)} | ${kb(current.server_app_bytes)} | ${kb(deltaServer)} |`,
  "",
  `Baseline file: \`${path.relative(projectRoot, baselinePath)}\``,
];
fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Bundle report written: ${path.relative(projectRoot, reportPath)}`);
