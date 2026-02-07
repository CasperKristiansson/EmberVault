import { expect, test } from "@playwright/test";

test("drags a tab to the other pane", async ({ page }) => {
  const firstTitle = "Drag Primary";
  const secondTitle = "Drag Secondary";
  const tabListTestId = "tab-list";
  const tabItemTestId = "tab-item";
  const splitToggleTestId = "toggle-split";
  const primaryPaneTestId = "editor-pane-primary";
  const secondaryPaneTestId = "editor-pane-secondary";
  const tabCount = 2;

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  const createNote = async (title: string): Promise<void> => {
    await page.getByTestId("new-note").click();
    await page.getByTestId("note-title").fill(title);
  };

  await createNote(firstTitle);
  await createNote(secondTitle);

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

  await secondaryPane.click();
  await page.getByTestId(`note-row-${firstId}`).click();

  await primaryPane.click();
  const draggedTab = page.locator(
    `[data-testid="${tabItemTestId}"][data-note-id="${secondId}"]`
  );

  await draggedTab.dispatchEvent("dragstart");
  await secondaryPane.dispatchEvent("dragover");
  await secondaryPane.dispatchEvent("drop");
  await draggedTab.dispatchEvent("dragend");

  await expect(page.getByTestId("note-title")).toHaveValue(firstTitle);
  await expect(page.getByTestId("note-title-secondary")).toHaveValue(
    secondTitle
  );
});
