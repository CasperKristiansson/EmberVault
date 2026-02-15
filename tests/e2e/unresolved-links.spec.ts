import { expect, test } from "@playwright/test";

test("unresolved links can be resolved to a stable id", async ({ page }) => {
  const alphaTitle = "Alpha";
  const firstIndex = 0;
  const secondIndex = 1;
  const saveStateSelector = '[data-save-state="saved"]';

  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await expect(page).toHaveURL(/\/app\/?$/);

  const bodyEditor = page.getByTestId("note-body");

  const createAlphaNote = async (index: number): Promise<void> => {
    await page.getByTestId("new-note").click();
    await bodyEditor.click();
    await page.keyboard.type(alphaTitle);
    await page.keyboard.press("Enter");
    await page.keyboard.type(`${alphaTitle} body ${index}`);
    await expect(page.locator(saveStateSelector)).toBeVisible();
  };

  // Create two notes with the same title to force ambiguity.
  await createAlphaNote(firstIndex);
  await createAlphaNote(secondIndex);

  // Create a source note that references the title-based link.
  await page.getByTestId("new-note").click();
  await bodyEditor.click();
  await page.keyboard.type("Source");
  await page.keyboard.press("Enter");
  await page.keyboard.type(`Link to [[${alphaTitle}]]`);
  await expect(page.locator(saveStateSelector)).toBeVisible();

  await page.getByTestId("right-panel-tab-metadata").click();

  const unresolvedList = page.getByTestId("unresolved-links-list");
  await expect(unresolvedList).toBeVisible();
  await expect(unresolvedList).toContainText(`[[${alphaTitle}]]`);

  // Resolve to the first match.
  await unresolvedList.getByRole("button", { name: "Resolve" }).click();

  await expect(page.locator(saveStateSelector)).toBeVisible();
  await expect(page.getByText("No unresolved links.")).toBeVisible();
});
