import { expect, test } from "@playwright/test";

test("opens, reorders, and closes tabs", async ({ page }) => {
  const firstTabTitle = "First tab";
  const secondTabTitle = "Second tab";
  const thirdTabTitle = "Third tab";
  const tabListTestId = "tab-list";
  const tabItemTestId = "tab-item";
  const firstIndex = 0;
  const secondIndex = 1;
  const thirdIndex = 2;
  const tabCountIncrement = 1;
  const initialTabCount = 3;
  const finalTabCount = 2;

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);
  await expect(page.getByTestId("new-note")).toBeEnabled();

  const tabList = page.getByTestId(tabListTestId);
  const tabItems = tabList.getByTestId(tabItemTestId);
  let expectedTabCount = 0;

  const createNote = async (title: string): Promise<void> => {
    await page.getByTestId("new-note").click();
    await page.getByTestId("note-title").fill(title);
    expectedTabCount += tabCountIncrement;
    await expect(tabItems).toHaveCount(expectedTabCount);
  };

  await createNote(firstTabTitle);
  await createNote(secondTabTitle);
  await createNote(thirdTabTitle);

  const readTabIds = async (): Promise<string[]> => {
    const ids = await tabItems.evaluateAll((elements: Element[]) =>
      elements.map((element: Element) => element.getAttribute("data-note-id"))
    );
    const resolved = ids.filter((id): id is string => typeof id === "string");
    if (resolved.length !== ids.length) {
      throw new Error("Missing tab ids");
    }
    return resolved;
  };

  await expect(tabItems).toHaveCount(initialTabCount);
  const [firstTabId, secondTabId, thirdTabId] = await readTabIds();

  const thirdTab = tabItems.nth(thirdIndex);
  const firstTab = tabItems.nth(firstIndex);

  await thirdTab.dispatchEvent("dragstart");
  await firstTab.dispatchEvent("dragover");
  await firstTab.dispatchEvent("drop");
  await thirdTab.dispatchEvent("dragend");

  expect(await readTabIds()).toEqual([thirdTabId, firstTabId, secondTabId]);

  const closeTarget = tabItems.nth(secondIndex);
  await closeTarget.click();
  await closeTarget.getByTestId("tab-close").click();

  await expect(tabItems).toHaveCount(finalTabCount);
  expect(await readTabIds()).toEqual([thirdTabId, secondTabId]);
});
