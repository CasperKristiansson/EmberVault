import { expect, test } from "@playwright/test";

test("slash menu inserts a checklist", async ({ page }) => {
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/.+/);

  await page.getByTestId("new-note").click();

  const bodyEditor = page.getByTestId("note-body");
  await bodyEditor.click();
  await page.keyboard.type("/");

  await expect(page.getByTestId("slash-menu")).toBeVisible();
  await page.getByTestId("slash-menu-item-checklist").click();

  await expect(page.locator('ul[data-type="taskList"]')).toBeVisible();
});
