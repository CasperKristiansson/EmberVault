import { expect, test } from "@playwright/test";

test("custom metadata fields persist after reload", async ({ page }) => {
  const noteTitle = "Metadata Note";

  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/.+/);

  await page.getByTestId("new-note").click();

  const titleInput = page.getByTestId("note-title");
  const metadataTab = page.getByTestId("right-panel-tab-metadata");
  await expect(titleInput).toBeVisible();
  await titleInput.fill(noteTitle);

  await metadataTab.click();
  await page.getByTestId("metadata-add-field").click();

  const keyInput = page.getByTestId("custom-field-key-0");
  await keyInput.fill("Mood");

  const valueInput = page.getByTestId("custom-field-value-0");
  await valueInput.fill("Focused");
  await titleInput.click();

  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await page.reload();

  await expect(titleInput).toBeVisible();
  await expect(titleInput).toHaveValue(noteTitle);

  await metadataTab.click();

  await expect(keyInput).toBeVisible();
  await expect(keyInput).toHaveValue("Mood");
  await expect(valueInput).toHaveValue("Focused");
});
