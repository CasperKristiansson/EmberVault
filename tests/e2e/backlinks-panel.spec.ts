import { expect, test } from "@playwright/test";

test("backlinks panel shows linked mentions", async ({ page }) => {
  const targetTitle = "Target Note";
  const sourceTitle = "Source Note";

  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  const createNote = async (title: string): Promise<void> => {
    await page.getByTestId("new-note").click();
    const bodyEditor = page.getByTestId("note-body");
    await bodyEditor.click();
    await expect(bodyEditor).toBeFocused();
    await page.keyboard.type(title);
    await page.keyboard.press("Enter");
  };

  await createNote(targetTitle);
  await createNote(sourceTitle);

  const tabList = page.getByTestId("tab-list");
  const targetTab = tabList
    .getByTestId("tab-item")
    .filter({ hasText: targetTitle });
  const sourceTab = tabList
    .getByTestId("tab-item")
    .filter({ hasText: sourceTitle });

  const targetId = await targetTab.getAttribute("data-note-id");
  const sourceId = await sourceTab.getAttribute("data-note-id");

  if (!targetId || !sourceId) {
    throw new Error("Missing note ids for backlink test");
  }

  const bodyEditor = page.getByTestId("note-body");
  await bodyEditor.click();
  await page.keyboard.type("[[");

  await expect(page.getByTestId("wiki-link-menu")).toBeVisible();
  await page.getByTestId(`wiki-link-item-${targetId}`).click();

  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await targetTab.click();
  await expect(page.getByTestId("note-body")).toContainText(targetTitle);

  await page.getByTestId("right-panel-tab-backlinks").click();

  const backlinkItem = page.getByTestId(`backlink-item-${sourceId}`);
  await expect(backlinkItem).toBeVisible();
  await expect(backlinkItem).toContainText(`[[${targetId}]]`);
});
