import { expect, test } from "@playwright/test";

test("metadata shows linked and unlinked mentions", async ({ page }) => {
  const targetTitle = "Alpha";
  const saveStateSelector = '[data-save-state="saved"]';

  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await expect(page).toHaveURL(/\/app\/?$/);

  // Create target note.
  await page.getByTestId("new-note").click();
  const bodyEditor = page.getByTestId("note-body");
  await bodyEditor.click();
  await page.keyboard.type(targetTitle);
  await page.keyboard.press("Enter");
  await page.keyboard.type("Target body");
  await expect(page.locator(saveStateSelector)).toBeVisible();

  // Create a note that links to Alpha via wiki link autocomplete.
  await page.getByTestId("new-note").click();
  await bodyEditor.click();
  await page.keyboard.type("Linked Note");
  await page.keyboard.press("Enter");
  await page.keyboard.type("This links to [[");
  await expect(page.getByTestId("wiki-link-menu")).toBeVisible();
  await page.keyboard.type(targetTitle);
  await page.keyboard.press("Enter");
  await expect(page.locator(saveStateSelector)).toBeVisible();

  // Create a note that mentions Alpha without linking.
  await page.getByTestId("new-note").click();
  await bodyEditor.click();
  await page.keyboard.type("Unlinked Note");
  await page.keyboard.press("Enter");
  await page.keyboard.type(`${targetTitle} appears here without a wiki link.`);
  await expect(page.locator(saveStateSelector)).toBeVisible();

  // Switch back to the target note via the tab, since other notes can contain
  // the title in their body preview.
  await page.getByRole("tab", { name: new RegExp(`^${targetTitle}`) }).click();

  await page.getByTestId("right-panel-tab-metadata").click();

  await expect(page.getByTestId("backlinks-panel")).toBeVisible();
  await expect(page.getByTestId("backlinks-list")).toContainText("Linked Note");
  await expect(page.getByTestId("unlinked-mentions-list")).toContainText(
    "Unlinked Note"
  );
});
