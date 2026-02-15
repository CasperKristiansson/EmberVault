import { expect, test } from "@playwright/test";

test("mobile layout shows bottom nav and switches panes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await expect(page).toHaveURL(/\/app\/?$/);

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
