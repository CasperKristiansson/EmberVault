import { expect, test } from "@playwright/test";

test("download and restore backup replaces vault contents", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  await page.getByTestId("new-note").click();
  const bodyEditor = page.getByTestId("note-body");
  await bodyEditor.click();
  await page.keyboard.type("First note");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Body A");

  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await page.getByTestId("new-note").click();
  await bodyEditor.click();
  await page.keyboard.type("Second note");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Body B");
  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await page.getByTestId("open-settings").click();
  await page.getByText("Import/Export").click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("download-backup").click();
  const download = await downloadPromise;
  const backupPath = test.info().outputPath("embervault-backup.json");
  await download.saveAs(backupPath);

  // Restore should remove notes created after the backup.
  await page.getByTestId("restore-backup-input").setInputFiles(backupPath);
  await page.getByRole("button", { name: "Restore" }).click();

  await expect(page.getByText("Backup restored.")).toBeVisible();

  // Note list should include the first note and not the second.
  const noteRows = page.locator('[data-testid^="note-row-"]');
  await expect(noteRows.filter({ hasText: "First note" })).toBeVisible();
  await expect(noteRows.filter({ hasText: "Second note" })).toHaveCount(0);
});
