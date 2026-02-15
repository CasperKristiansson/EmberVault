import { expect, test } from "@playwright/test";

test("right panel shows metadata tab for selected note", async ({ page }) => {
  const noteTitle = "Target Note";
  const emptyCount = 0;

  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await expect(page).toHaveURL(/\/app\/?$/);

  await page.getByTestId("new-note").click();
  const bodyEditor = page.getByTestId("note-body");
  await bodyEditor.click();
  await expect(bodyEditor).toBeFocused();
  await page.keyboard.type(noteTitle);
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("right-panel-tab-outline")).toBeVisible();
  await expect(page.getByTestId("right-panel-tab-metadata")).toBeVisible();
  await expect(page.getByTestId("right-panel-tab-backlinks")).toHaveCount(
    emptyCount
  );

  await page.getByTestId("right-panel-tab-metadata").click();
  await expect(page.getByTestId("metadata-panel")).toBeVisible();
});
