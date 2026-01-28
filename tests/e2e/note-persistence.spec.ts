import { expect, test } from "@playwright/test";

test("create and edit a note persists after reload", async ({ page }) => {
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/.+/);

  await page.getByTestId("new-note").click();

  const titleInput = page.getByTestId("note-title");
  const bodyInput = page.getByTestId("note-body");

  await expect(titleInput).toBeVisible();
  await titleInput.fill("E2E Note");
  await bodyInput.fill("Hello from Playwright");

  await expect(page.locator('[data-save-state="saving"]')).toBeVisible();
  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await page.reload();

  await expect(titleInput).toHaveValue("E2E Note");
  await expect(bodyInput).toHaveValue("Hello from Playwright");
});
