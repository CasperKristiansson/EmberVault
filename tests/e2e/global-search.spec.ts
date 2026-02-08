import { expect, test } from "@playwright/test";

test("global search returns results with snippet", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  await page.getByTestId("new-note").click();

  const bodyEditor = page.getByTestId("note-body");

  await bodyEditor.click();
  await expect(bodyEditor).toBeFocused();
  await page.keyboard.type("Searchable Note");
  await page.keyboard.press("Enter");
  await page.keyboard.type("The quick brown fox jumps over the log.");

  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await page.getByTestId("open-global-search").click();

  const searchInput = page.getByLabel("Search notes");
  await searchInput.fill("quick");

  const results = page.getByTestId("search-results");
  await expect(results).toContainText("Searchable Note");
  await expect(results).toContainText("quick brown fox");
});

test("global search finds note by partial typo", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  await page.getByTestId("new-note").click();

  const bodyEditor = page.getByTestId("note-body");

  await bodyEditor.click();
  await expect(bodyEditor).toBeFocused();
  await page.keyboard.type("Project Plan");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Kickoff notes for the quarterly plan.");

  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await page.getByTestId("open-global-search").click();

  const searchInput = page.getByLabel("Search notes");
  await searchInput.fill("prject");

  const results = page.getByTestId("search-results");
  await expect(results).toContainText("Project Plan");
});
