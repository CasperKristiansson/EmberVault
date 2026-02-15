import { expect, test } from "@playwright/test";

test("custom metadata fields persist after reload", async ({ page }) => {
  const noteTitle = "Metadata Note";

  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await expect(page).toHaveURL(/\/app\/?$/);

  await page.getByTestId("new-note").click();

  const bodyEditor = page.getByTestId("note-body");
  const metadataTab = page.getByTestId("right-panel-tab-metadata");
  await expect(bodyEditor).toBeVisible();
  await bodyEditor.click();
  await expect(bodyEditor).toBeFocused();
  await page.keyboard.type(noteTitle);
  await page.keyboard.press("Enter");

  await metadataTab.click();
  await page.getByTestId("metadata-add-field").click();

  const keyInput = page.getByTestId("custom-field-key-0");
  await keyInput.fill("Mood");

  const valueInput = page.getByTestId("custom-field-value-0");
  await valueInput.fill("Focused");
  await bodyEditor.click();

  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await page.reload();

  await expect(bodyEditor).toBeVisible();
  await expect(bodyEditor).toContainText(noteTitle);

  await metadataTab.click();

  await expect(keyInput).toBeVisible();
  await expect(keyInput).toHaveValue("Mood");
  await expect(valueInput).toHaveValue("Focused");
});
