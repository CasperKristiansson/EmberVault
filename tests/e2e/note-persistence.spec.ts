import { expect, test } from "@playwright/test";

test("create and edit a note persists after reload", async ({ page }) => {
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  await page.getByTestId("new-note").click();

  const bodyEditor = page.getByTestId("note-body");

  await expect(bodyEditor).toBeVisible();
  await bodyEditor.click();
  await expect(bodyEditor).toBeFocused();
  await page.keyboard.type("E2E Note");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Hello from Playwright");

  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await page.reload();

  await expect(bodyEditor).toContainText("E2E Note");
  await expect(bodyEditor).toContainText("Hello from Playwright");
});
