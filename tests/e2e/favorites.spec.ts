import { expect, test } from "@playwright/test";

test("favorites filter shows starred notes", async ({ page }) => {
  const emptyCount = 0;
  const ariaPressed = "aria-pressed";
  const pressedValue = "true";
  const rowFavoriteTestId = "note-favorite-toggle-row";
  const firstTitle = "Starred One";
  const secondTitle = "Starred Two";

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  await page.getByTestId("new-note").click();
  const bodyEditor = page.getByTestId("note-body");
  await bodyEditor.click();
  await expect(bodyEditor).toBeFocused();
  await page.keyboard.type(firstTitle);
  await page.keyboard.press("Enter");
  await page.getByTestId("note-favorite-toggle").click();
  await expect(page.getByTestId("note-favorite-toggle")).toHaveAttribute(
    ariaPressed,
    pressedValue
  );

  await page.getByTestId("new-note").click();
  await bodyEditor.click();
  await expect(bodyEditor).toBeFocused();
  await page.keyboard.type(secondTitle);
  await page.keyboard.press("Enter");

  const noteList = page.getByTestId("note-list");
  const secondRow = noteList
    .locator('[data-testid^="note-row-"]')
    .filter({ hasText: secondTitle })
    .first();
  await secondRow.hover();
  await secondRow.getByTestId(rowFavoriteTestId).click();
  await expect(secondRow.getByTestId(rowFavoriteTestId)).toHaveAttribute(
    ariaPressed,
    pressedValue
  );

  await page.getByTestId("filter-favorites").click();

  await expect(noteList.getByText(firstTitle, { exact: true })).toBeVisible();
  await expect(noteList.getByText(secondTitle, { exact: true })).toBeVisible();

  await secondRow.hover();
  await secondRow.getByTestId(rowFavoriteTestId).click();

  await expect(noteList.getByText(secondTitle, { exact: true })).toHaveCount(
    emptyCount
  );
  await expect(noteList.getByText(firstTitle, { exact: true })).toBeVisible();
});
