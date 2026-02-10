import { expect, test } from "@playwright/test";

test("trash restores and deletes notes permanently", async ({ page }) => {
  const restoreTitle = "Restore Note";
  const deleteTitle = "Delete Note";
  const emptyCount = 0;
  const confirmDialogTestId = "confirm-dialog";
  const confirmSubmitTestId = "confirm-submit";

  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  await page.getByTestId("new-note").click();
  const bodyEditor = page.getByTestId("note-body");
  await bodyEditor.click();
  await expect(bodyEditor).toBeFocused();
  await page.keyboard.type(restoreTitle);
  await page.keyboard.press("Enter");
  const noteList = page.getByTestId("note-list");
  await expect(noteList.getByText(restoreTitle)).toBeVisible();
  await page.getByTestId("note-delete").click();
  const moveConfirm = page.getByTestId(confirmDialogTestId);
  await expect(moveConfirm).toBeVisible();
  await moveConfirm.getByTestId(confirmSubmitTestId).click();
  await expect(noteList.getByText(restoreTitle)).toHaveCount(emptyCount);

  await page.getByTestId("new-note").click();
  await bodyEditor.click();
  await expect(bodyEditor).toBeFocused();
  await page.keyboard.type(deleteTitle);
  await page.keyboard.press("Enter");
  await expect(noteList.getByText(deleteTitle)).toBeVisible();
  await page.getByTestId("note-delete").click();
  const secondMoveConfirm = page.getByTestId(confirmDialogTestId);
  await expect(secondMoveConfirm).toBeVisible();
  await secondMoveConfirm.getByTestId(confirmSubmitTestId).click();
  await expect(noteList.getByText(deleteTitle)).toHaveCount(emptyCount);

  await page.getByTestId("open-trash").click();

  const trashModal = page.getByTestId("trash-modal");
  await expect(trashModal).toBeVisible();

  const trashList = trashModal.getByTestId("trash-list");
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

  await trashModal.getByTestId("trash-close").click();
  await expect(noteList.getByText(restoreTitle, { exact: true })).toBeVisible();
});
