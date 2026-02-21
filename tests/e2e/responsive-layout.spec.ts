import { expect, test } from "@playwright/test";

const mobileViewport = { width: 375, height: 812 };
const appPathPattern = /\/app\/?$/;
const onboardingPath = "/onboarding";
const browserStorageButton = "use-browser-storage";

test("mobile layout shows bottom nav and switches panes", async ({ page }) => {
  await page.setViewportSize(mobileViewport);
  await page.goto(onboardingPath);

  await page.getByTestId(browserStorageButton).click();
  await expect(page).toHaveURL(appPathPattern);

  const nav = page.getByTestId("mobile-nav");
  const notesPane = page.getByTestId("note-list-pane");
  const editorPane = page.getByTestId("editor-pane");

  await expect(nav).toBeVisible();
  await expect(notesPane).toBeVisible();
  await expect(editorPane).toBeHidden();

  await page.getByTestId("new-note").click();
  await page.getByTestId("mobile-nav-editor").click();

  await expect(editorPane).toBeVisible();
  await expect(notesPane).toBeHidden();
  await expect(page.getByTestId("note-body")).toBeVisible();
});

test("mobile selecting a note switches to editor automatically", async ({
  page,
}) => {
  await page.setViewportSize(mobileViewport);
  await page.goto(onboardingPath);

  await page.getByTestId(browserStorageButton).click();
  await expect(page).toHaveURL(appPathPattern);

  await page.getByTestId("new-note").click();
  await page.getByTestId("mobile-nav-notes").click();

  const firstNote = page.locator('[data-testid^="note-row-"]').first();
  await expect(firstNote).toBeVisible();
  await firstNote.click();

  await expect(page.getByTestId("editor-pane")).toBeVisible();
  await expect(page.getByTestId("note-list-pane")).toBeHidden();
});

test("tablet right panel behaves as an overlay with backdrop close", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(onboardingPath);

  await page.getByTestId(browserStorageButton).click();
  await expect(page).toHaveURL(appPathPattern);

  await page.getByTestId("new-note").click();
  await page.getByTestId("right-panel-tab-metadata").click();

  const rightPanel = page.getByTestId("right-panel-pane");
  const backdrop = page.getByTestId("right-panel-backdrop");

  await expect(rightPanel).toBeVisible();
  await expect(backdrop).toBeVisible();

  await backdrop.click();
  await expect(backdrop).toBeHidden();
});
