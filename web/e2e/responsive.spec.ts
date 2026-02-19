import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
];

const routes = [
  { route: "/", slug: "home" },
  { route: "/login", slug: "login" },
  { route: "/signup", slug: "signup" },
  { route: "/app", slug: "app" },
  { route: "/app/drafts/new", slug: "draft-new" },
  { route: "/app/jobs/sample-job", slug: "job-detail" },
];

const outputDir = path.join("..", "var", "reports", "ui");
fs.mkdirSync(outputDir, { recursive: true });

for (const viewport of viewports) {
  test.describe(`responsive snapshots ${viewport.name}`, () => {
    for (const target of routes) {
      test(`${target.route} snapshot`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(target.route);
        await page.waitForTimeout(400);
        const filename = path.join(
          outputDir,
          `${target.slug}-${viewport.name}.png`,
        );
        await page.screenshot({ path: filename, fullPage: true });
      });
    }
  });
}
