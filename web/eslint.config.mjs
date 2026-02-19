import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const cwd = path.dirname(fileURLToPath(import.meta.url));
const exceptionsPath = path.join(cwd, ".eslint-exceptions.json");
let consoleExceptions = [];
try {
  const parsed = JSON.parse(fs.readFileSync(exceptionsPath, "utf8"));
  if (Array.isArray(parsed.allow_console_in)) {
    consoleExceptions = parsed.allow_console_in.filter((entry) => typeof entry === "string");
  }
} catch {
  consoleExceptions = [];
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": "warn",
    },
  },
  ...(consoleExceptions.length
    ? [
        {
          files: consoleExceptions,
          rules: {
            "no-console": "off",
          },
        },
      ]
    : []),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
