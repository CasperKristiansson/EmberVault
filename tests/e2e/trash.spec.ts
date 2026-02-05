import { expect, test } from "@playwright/test";

test("trash restores and deletes notes permanently", async ({ page }) => {
  const restoreTitle = "Restore Note";
  const deleteTitle = "Delete Note";
  const emptyCount = 0;

  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/.+/);

  await page.getByTestId("new-note").click();
  await page.getByTestId("note-title").fill(restoreTitle);
  const noteList = page.getByTestId("note-list");
  await expect(noteList.getByText(restoreTitle)).toBeVisible();
  await page.getByTestId("note-delete").click();
  await expect(noteList.getByText(restoreTitle)).toHaveCount(emptyCount);

  await page.getByTestId("new-note").click();
  await page.getByTestId("note-title").fill(deleteTitle);
  await expect(noteList.getByText(deleteTitle)).toBeVisible();
  await page.getByTestId("note-delete").click();
  await expect(noteList.getByText(deleteTitle)).toHaveCount(emptyCount);

  await page.getByTestId("filter-trash").click();

  const trashList = page.getByTestId("note-list");
  const restoreRow = trashList
    .getByTestId("trash-row")
    .filter({ hasText: restoreTitle });

  await expect(restoreRow).toBeVisible();
  await restoreRow.getByTestId("trash-restore").click();

  await expect(trashList.getByText(restoreTitle)).toHaveCount(emptyCount);

  const deleteRow = trashList
    .getByTestId("trash-row")
    .filter({ hasText: deleteTitle });

  await expect(deleteRow).toBeVisible();
  await deleteRow.getByTestId("trash-delete").click();

  const confirmDialog = page.getByTestId("confirm-dialog");
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByTestId("confirm-submit").click();

  await expect(trashList.getByText(deleteTitle)).toHaveCount(emptyCount);

  await page.getByTestId("filter-trash").click();
  await expect(page.getByText(restoreTitle)).toBeVisible();
});
