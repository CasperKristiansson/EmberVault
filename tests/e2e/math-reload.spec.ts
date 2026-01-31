import { expect, test } from "@playwright/test";

const noteBodyTestId = "note-body";
const noteBodySelector = `[data-testid="${noteBodyTestId}"]`;
const onboardingPath = "/onboarding";
const useBrowserStorageTestId = "use-browser-storage";
const newNoteTestId = "new-note";

const isContentEditable = function isContentEditable(
  selector: string
): boolean {
  const target = document.querySelector(selector);
  return target instanceof HTMLElement && target.isContentEditable;
};

test("insert LaTeX persists after reload", async ({ page }) => {
  await page.goto(onboardingPath);
  await page.getByTestId(useBrowserStorageTestId).click();
  await page.waitForURL(/\/app\/.+/);

  await page.getByTestId(newNoteTestId).click();

  const editor = page.getByTestId(noteBodyTestId);
  await editor.click();
  await page.waitForFunction(isContentEditable, noteBodySelector);

  const blockLatex = String.raw`c = \sqrt{a^2 + b^2}`;
  const blockSource = `$$${blockLatex}$$`;
  await page.keyboard.type(blockSource);

  const blockNode = page.locator('div[data-type="math-block"] pre');
  await expect(blockNode).toContainText(blockLatex);
  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await page.reload();

  await expect(page.getByTestId(noteBodyTestId)).toBeVisible();
  await expect(page.locator('div[data-type="math-block"] pre')).toContainText(
    blockLatex
  );
});
