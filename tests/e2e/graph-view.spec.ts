import { expect, test } from "@playwright/test";

const noteSaveWaitMs = 600;
const clickGraphNode = (noteIdValue: string): boolean =>
  (globalThis as any).embervaultGraphTest?.clickNode(noteIdValue) ?? false;

test("graph view opens from sidebar, renders, and opens notes on click", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/.+/);

  await page.getByTestId("new-note").click();
  await page.getByTestId("note-title").fill("Graph Seed");
  await page.waitForTimeout(noteSaveWaitMs);

  const appUrl = page.url();
  const appUrlWithQuery = appUrl.includes("?")
    ? `${appUrl}&e2e=1`
    : `${appUrl}?e2e=1`;
  await page.goto(appUrlWithQuery);

  const noteRow = page.locator("[data-note-id]").first();
  await expect(noteRow).toBeVisible();
  const noteId = await noteRow.getAttribute("data-note-id");
  if (!noteId) {
    throw new Error("Expected note row to provide a note id.");
  }

  await page.getByTestId("sidebar-view-graph").click();

  await expect(page.getByTestId("graph-view")).toBeVisible();
  await expect(page.getByTestId("graph-toolbar")).toBeVisible();
  await expect(page.getByTestId("graph-canvas")).toBeVisible();

  await page.waitForFunction(() =>
    Boolean((globalThis as any).embervaultGraphTest?.clickNode)
  );
  const clickResult = await page.evaluate(clickGraphNode, noteId);
  expect(clickResult).toBe(true);

  await expect(page.getByTestId("note-title")).toHaveValue("Graph Seed");
});
