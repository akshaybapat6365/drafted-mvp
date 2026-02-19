import { expect, test } from "@playwright/test";

test.describe("core route smoke", () => {
  test("home route renders headline and primary CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Blueprint-grade");
    await expect(page.getByRole("link", { name: /Open Studio/i })).toBeVisible();
  });

  test("draft route renders composer controls", async ({ page }) => {
    await page.goto("/app/drafts/new");
    await expect(page.getByText("Preset launchpad")).toBeVisible();
    await expect(page.getByRole("button", { name: /Create draft job/i })).toBeVisible();
  });

  test("job route renders timeline shell for unknown job id", async ({ page }) => {
    await page.goto("/app/jobs/non-existent-job");
    await expect(page.getByText(/Execution Feed/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Copy job ID/i })).toBeVisible();
  });
});
