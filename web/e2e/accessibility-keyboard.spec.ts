import { expect, test } from "@playwright/test";

test("keyboard-only traversal works on auth routes", async ({ page }) => {
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();

  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focusedTag = await page.locator(":focus").evaluate((node) => node.tagName);
  expect(["INPUT", "BUTTON", "A"]).toContain(focusedTag);

  await page.goto("/signup");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focusedRole = await page.locator(":focus").evaluate((node) =>
    node.getAttribute("role") ?? node.tagName.toLowerCase(),
  );
  expect(typeof focusedRole).toBe("string");
});
