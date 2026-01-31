import { expect, test } from "@playwright/test";

test("global search returns results with snippet", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/.+/);

  await page.getByTestId("new-note").click();

  const titleInput = page.getByTestId("note-title");
  const bodyEditor = page.getByTestId("note-body");

  await titleInput.fill("Searchable Note");
  await bodyEditor.click();
  await page.keyboard.type("The quick brown fox jumps over the log.");

  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await page.getByTestId("open-global-search").click();

  const searchInput = page.getByLabel("Search notes");
  await searchInput.fill("quick");

  const results = page.getByTestId("search-results");
  await expect(results).toContainText("Searchable Note");
  await expect(results).toContainText("quick brown fox");
});
