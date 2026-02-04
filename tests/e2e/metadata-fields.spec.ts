import { expect, test } from "@playwright/test";

test("custom metadata fields persist after reload", async ({ page }) => {
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/.+/);

  await page.getByTestId("new-note").click();

  const titleInput = page.getByTestId("note-title");
  await expect(titleInput).toBeVisible();
  await titleInput.fill("Metadata Note");

  await page.getByTestId("right-panel-tab-metadata").click();
  await page.getByTestId("metadata-add-field").click();

  const keyInput = page.getByTestId("custom-field-key-0");
  await keyInput.fill("Mood");

  const valueInput = page.getByTestId("custom-field-value-0");
  await valueInput.fill("Focused");
  await titleInput.click();

  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await page.reload();

  await page.getByTestId("right-panel-tab-metadata").click();

  await expect(page.getByTestId("custom-field-key-0")).toHaveValue("Mood");
  await expect(page.getByTestId("custom-field-value-0")).toHaveValue("Focused");
});
