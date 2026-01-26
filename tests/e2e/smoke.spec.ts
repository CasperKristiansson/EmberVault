import { test, expect } from "@playwright/test";

test("playwright is wired", async ({ page }) => {
  await page.setContent("<h1>Playwright ready</h1>");
  await expect(
    page.getByRole("heading", { name: "Playwright ready" })
  ).toBeVisible();
});
