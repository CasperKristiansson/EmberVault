import { expect, test } from "@playwright/test";

const onboardingPath = "/onboarding";
const useBrowserStorageTestId = "use-browser-storage";
const newNoteTestId = "new-note";
const noteBodyTestId = "note-body";
const slashMenuTestId = "slash-menu";
const pngMime = "image/png";
const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5V0f8AAAAASUVORK5CYII=";

test("slash menu inserts a checklist", async ({ page }) => {
  await page.goto(onboardingPath);

  await page.getByTestId(useBrowserStorageTestId).click();
  await expect(page).toHaveURL(/\/app\/?$/);

  await page.getByTestId(newNoteTestId).click();

  const bodyEditor = page.getByTestId(noteBodyTestId);
  await bodyEditor.click();
  await page.keyboard.type("/");

  await expect(page.getByTestId(slashMenuTestId)).toBeVisible();
  await page.getByTestId("slash-menu-item-checklist").click();

  await expect(page.locator('ul[data-type="taskList"]')).toBeVisible();
});

test("slash menu inserts a callout", async ({ page }) => {
  await page.goto(onboardingPath);
  await page.getByTestId(useBrowserStorageTestId).click();
  await expect(page).toHaveURL(/\/app\/?$/);

  await page.getByTestId(newNoteTestId).click();
  const bodyEditor = page.getByTestId(noteBodyTestId);
  await bodyEditor.click();
  await page.keyboard.type("/");

  await expect(page.getByTestId(slashMenuTestId)).toBeVisible();
  await page.getByTestId("slash-menu-item-callout").click();

  await expect(page.locator('div[data-type="callout"]')).toBeVisible();
});

test("slash menu inserts an embed url block", async ({ page }) => {
  const url = "https://example.com/";

  await page.goto(onboardingPath);
  await page.getByTestId(useBrowserStorageTestId).click();
  await expect(page).toHaveURL(/\/app\/?$/);

  await page.getByTestId(newNoteTestId).click();
  const bodyEditor = page.getByTestId(noteBodyTestId);
  await bodyEditor.click();
  await page.keyboard.type("/");

  await expect(page.getByTestId(slashMenuTestId)).toBeVisible();
  await page.getByTestId("slash-menu-item-embed").click();

  await expect(page.getByTestId("embed-prompt")).toBeVisible();
  await page.getByTestId("embed-prompt-input").fill(url);
  await page.getByTestId("embed-prompt-insert").click();

  const embed = page.locator('div[data-type="embed"]');
  await expect(embed).toBeVisible();
  await expect(embed).toContainText(url);
});

test("slash menu inserts an image from file picker", async ({ page }) => {
  await page.goto(onboardingPath);
  await page.getByTestId(useBrowserStorageTestId).click();
  await expect(page).toHaveURL(/\/app\/?$/);

  await page.getByTestId(newNoteTestId).click();
  const bodyEditor = page.getByTestId(noteBodyTestId);
  await bodyEditor.click();
  await page.keyboard.type("/");

  await expect(page.getByTestId(slashMenuTestId)).toBeVisible();

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByTestId("slash-menu-item-image").click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "tiny.png",
    mimeType: pngMime,
    buffer: Buffer.from(pngBase64, "base64"),
  });

  await expect(page.locator("img[data-asset-id]")).toBeVisible();
});
