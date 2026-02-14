import { expect, test } from "@playwright/test";

test("metadata shows linked and unlinked mentions", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  // Create target note "Alpha".
  await page.getByTestId("new-note").click();
  const bodyEditor = page.getByTestId("note-body");
  await bodyEditor.click();
  await page.keyboard.type("Alpha");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Target body");
  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  // Create a note that links to Alpha via wiki link autocomplete.
  await page.getByTestId("new-note").click();
  await bodyEditor.click();
  await page.keyboard.type("Linked Note");
  await page.keyboard.press("Enter");
  await page.keyboard.type("This links to [[");
  await expect(page.getByTestId("wiki-link-menu")).toBeVisible();
  await page.keyboard.type("Alpha");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  // Create a note that mentions Alpha without linking.
  await page.getByTestId("new-note").click();
  await bodyEditor.click();
  await page.keyboard.type("Unlinked Note");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Alpha appears here without a wiki link.");
  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  // Open Alpha and check metadata backlinks.
  const noteRows = page.locator('[data-testid^="note-row-"]');
  await noteRows.filter({ hasText: "Alpha" }).first().click();

  await page.getByTestId("right-panel-tab-metadata").click();

  await expect(page.getByTestId("backlinks-panel")).toBeVisible();
  await expect(page.getByTestId("backlinks-list")).toContainText("Linked Note");
  await expect(page.getByTestId("unlinked-mentions-list")).toContainText(
    "Unlinked Note"
  );
});

