import { expect, test } from "@playwright/test";

test("wiki link autocomplete inserts note id", async ({ page }) => {
  const targetTitle = "Link Target";
  const sourceTitle = "Link Source";

  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/.+/);

  const createNote = async (title: string): Promise<void> => {
    await page.getByTestId("new-note").click();
    await page.getByTestId("note-title").fill(title);
  };

  await createNote(targetTitle);
  await createNote(sourceTitle);

  const tabList = page.getByTestId("tab-list");
  const targetTab = tabList
    .getByTestId("tab-item")
    .filter({ hasText: targetTitle });
  const targetId = await targetTab.getAttribute("data-note-id");
  if (!targetId) {
    throw new Error("Missing target note id");
  }

  const bodyEditor = page.getByTestId("note-body");
  await bodyEditor.click();
  await page.keyboard.type("[[");

  await expect(page.getByTestId("wiki-link-menu")).toBeVisible();
  await page.getByTestId(`wiki-link-item-${targetId}`).click();

  await expect(bodyEditor).toContainText(`[[${targetId}]]`);
});
