import { expect, test } from "@playwright/test";

const noteSaveWaitMs = 600;
const isGraphHelperReady = (): boolean =>
  Boolean((globalThis as any).embervaultGraphTest?.hasEdge);
const hasGraphEdge = (ids: string[]): boolean => {
  const [sourceId, targetId] = ids;
  if (!sourceId || !targetId) {
    return false;
  }
  return (
    (globalThis as any).embervaultGraphTest?.hasEdge?.(sourceId, targetId) ??
    false
  );
};
const clickGraphNode = (noteIdValue: string): boolean =>
  (globalThis as any).embervaultGraphTest?.clickNode(noteIdValue) ?? false;

test("graph view shows link edges and opens notes on click", async ({
  page,
}) => {
  const targetTitle = "Graph Target";
  const sourceTitle = "Graph Source";

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

  const sourceTab = tabList
    .getByTestId("tab-item")
    .filter({ hasText: sourceTitle });
  const sourceId = await sourceTab.getAttribute("data-note-id");
  if (!sourceId) {
    throw new Error("Missing source note id");
  }

  const bodyEditor = page.getByTestId("note-body");
  await bodyEditor.click();
  await page.keyboard.type("[[");
  await expect(page.getByTestId("wiki-link-menu")).toBeVisible();
  await page.getByTestId(`wiki-link-item-${targetId}`).click();
  await expect(bodyEditor).toContainText(`[[${targetId}]]`);
  await page.waitForTimeout(noteSaveWaitMs);

  const appUrl = page.url();
  const appUrlWithQuery = appUrl.includes("?")
    ? `${appUrl}&e2e=1`
    : `${appUrl}?e2e=1`;
  await page.goto(appUrlWithQuery);

  await expect(page.getByTestId(`note-row-${sourceId}`)).toBeVisible();

  await page.getByTestId("sidebar-view-graph").click();

  await expect(page.getByTestId("graph-view")).toBeVisible();
  await expect(page.getByTestId("graph-toolbar")).toBeVisible();
  await expect(page.getByTestId("graph-canvas")).toBeVisible();

  await page.waitForFunction(isGraphHelperReady);
  await page.waitForFunction(hasGraphEdge, [sourceId, targetId]);

  const clickResult = await page.evaluate(clickGraphNode, targetId);
  expect(clickResult).toBe(true);

  await expect(page.getByTestId("note-title")).toHaveValue(targetTitle);
});
