import { expect, test } from "@playwright/test";

test("unresolved links can be resolved to a stable id", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  const bodyEditor = page.getByTestId("note-body");

  // Create two notes with the same title to force ambiguity.
  for (let i = 0; i < 2; i += 1) {
    await page.getByTestId("new-note").click();
    await bodyEditor.click();
    await page.keyboard.type("Alpha");
    await page.keyboard.press("Enter");
    await page.keyboard.type(`Alpha body ${i}`);
    await expect(page.locator('[data-save-state="saved"]')).toBeVisible();
  }

  // Create a source note that references the title-based link.
  await page.getByTestId("new-note").click();
  await bodyEditor.click();
  await page.keyboard.type("Source");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Link to [[Alpha]]");
  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await page.getByTestId("right-panel-tab-metadata").click();

  const unresolvedList = page.getByTestId("unresolved-links-list");
  await expect(unresolvedList).toBeVisible();
  await expect(unresolvedList).toContainText("[[Alpha]]");

  // Resolve to the first match.
  await unresolvedList.getByRole("button", { name: "Resolve" }).click();

  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();
  await expect(page.getByText("No unresolved links.")).toBeVisible();
});

