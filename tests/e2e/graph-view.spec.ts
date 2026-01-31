import { expect, test } from "@playwright/test";

test("graph view opens from sidebar and renders", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/.+/);

  await page.getByTestId("new-note").click();
  await page.getByTestId("note-title").fill("Graph Seed");

  await page.getByTestId("sidebar-view-graph").click();

  await expect(page.getByTestId("graph-view")).toBeVisible();
  await expect(page.getByTestId("graph-toolbar")).toBeVisible();
  await expect(page.getByTestId("graph-canvas")).toBeVisible();
});
