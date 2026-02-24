import { expect, test } from "@playwright/test";
import { enterBrowserStorageApp } from "./helpers/enter-browser-storage-app";

const noteListTitleTestId = "note-list-title";
const projectsOverlayTestId = "projects-overlay";
const projectsAllNotesTestId = "projects-all-notes";
const emptyCount = 0;

test("desktop projects view replaces notes pane content", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterBrowserStorageApp(page);

  await expect(page.getByTestId(noteListTitleTestId)).toBeVisible();
  await page.getByTestId("projects-toggle").click();

  await expect(page.getByTestId(projectsOverlayTestId)).toBeVisible();
  await expect(page.getByTestId(projectsAllNotesTestId)).toBeVisible();
  await expect(page.getByTestId(noteListTitleTestId)).toHaveCount(emptyCount);

  await page.getByTestId(projectsAllNotesTestId).click();
  await expect(page.getByTestId(projectsOverlayTestId)).toHaveCount(emptyCount);
  await expect(page.getByTestId(noteListTitleTestId)).toBeVisible();
});
