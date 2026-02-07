import { expect, test } from "@playwright/test";

test("split view opens two notes and persists", async ({ page }) => {
  const primaryContent = "Primary-content";
  const secondaryContent = "Secondary-content";
  const primaryNoteTitle = "Split Primary";
  const secondaryNoteTitle = "Split Secondary";
  const tabCount = 2;
  const noteTitleTestId = "note-title";
  const noteTitleSecondaryTestId = "note-title-secondary";
  const noteBodyTestId = "note-body";
  const noteBodySecondaryTestId = "note-body-secondary";
  const splitToggleTestId = "toggle-split";
  const primaryPaneTestId = "editor-pane-primary";
  const secondaryPaneTestId = "editor-pane-secondary";
  const tabListTestId = "tab-list";
  const tabItemTestId = "tab-item";

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  const createNote = async (title: string): Promise<void> => {
    await page.getByTestId("new-note").click();
    await page.getByTestId(noteTitleTestId).fill(title);
  };

  await createNote(primaryNoteTitle);
  await createNote(secondaryNoteTitle);

  const tabItems = page.getByTestId(tabListTestId).getByTestId(tabItemTestId);
  await expect(tabItems).toHaveCount(tabCount);

  const ids = await tabItems.evaluateAll((elements: Element[]) =>
    elements.map((element: Element) => element.getAttribute("data-note-id"))
  );
  const resolved = ids.filter((id): id is string => typeof id === "string");
  if (resolved.length !== ids.length) {
    throw new Error("Missing tab ids");
  }
  const [firstId, secondId] = resolved;

  await page.getByTestId(splitToggleTestId).click();

  const primaryPane = page.getByTestId(primaryPaneTestId);
  const secondaryPane = page.getByTestId(secondaryPaneTestId);
  await expect(primaryPane).toBeVisible();
  await expect(secondaryPane).toBeVisible();

  await primaryPane.click();
  await page.getByTestId(`note-row-${secondId}`).click();
  const primaryBody = page.getByTestId(noteBodyTestId);
  await primaryBody.click();
  await page.keyboard.insertText(primaryContent);

  await secondaryPane.click();
  await page.getByTestId(`note-row-${firstId}`).click();
  const secondaryBody = page.getByTestId(noteBodySecondaryTestId);
  await secondaryBody.click();
  await page.keyboard.insertText(secondaryContent);

  await expect(page.locator('[data-save-state="saving"]')).toBeVisible();
  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await page.reload();

  await expect(page.getByTestId(primaryPaneTestId)).toBeVisible();
  await expect(page.getByTestId(secondaryPaneTestId)).toBeVisible();
  await expect(page.getByTestId(noteTitleTestId)).toHaveValue(
    secondaryNoteTitle
  );
  await expect(page.getByTestId(noteTitleSecondaryTestId)).toHaveValue(
    primaryNoteTitle
  );
  await expect(page.getByTestId(noteBodyTestId)).toContainText(primaryContent);
  await expect(page.getByTestId(noteBodySecondaryTestId)).toContainText(
    secondaryContent
  );
});
