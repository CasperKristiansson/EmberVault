import { expect, test } from "@playwright/test";

test("create template and apply to new note", async ({ page }) => {
  const templateTitleText = "Daily Standup";
  const templateBodyText = "What did I do yesterday?";

  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/.+/);

  await page.getByTestId("sidebar-view-templates").click();
  await page.getByTestId("new-template").click();

  const templateTitleInput = page.getByTestId("template-title");
  const templateBodyEditor = page.getByTestId("template-body");

  await expect(templateTitleInput).toBeVisible();
  await templateTitleInput.fill(templateTitleText);
  await templateBodyEditor.click();
  await page.keyboard.type(templateBodyText);

  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await page.getByTestId("sidebar-view-notes").click();
  await page.getByTestId("new-note-from-template").click();

  await page
    .getByTestId("template-picker-list")
    .getByRole("button", { name: templateTitleText })
    .click();

  const noteTitle = page.getByTestId("note-title");
  const noteBody = page.getByTestId("note-body");

  await expect(noteTitle).toHaveValue(templateTitleText);
  await expect(noteBody).toContainText(templateBodyText);

  await page.reload();

  await expect(noteTitle).toHaveValue(templateTitleText);
  await expect(noteBody).toContainText(templateBodyText);
});
