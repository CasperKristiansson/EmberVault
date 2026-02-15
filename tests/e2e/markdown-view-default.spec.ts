import { expect, test } from "@playwright/test";

test("markdown view by default opens notes in markdown preview", async ({
  page,
}) => {
  const title = "Markdown default note";
  const hiddenCount = 0;

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await expect(page).toHaveURL(/\/app\/?$/);

  await page.getByTestId("open-settings").click();
  await expect(page.getByTestId("settings-modal")).toBeVisible();
  await page.getByRole("button", { name: "Editor" }).click();
  await page.getByRole("button", { name: "Markdown view by default" }).click();
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(page.getByTestId("settings-modal")).toHaveCount(hiddenCount);

  await page.getByTestId("new-note").click();
  await expect(page.getByTestId("markdown-preview")).toBeVisible();

  await page.getByTestId("toggle-markdown-view").click();
  const editor = page.getByTestId("note-body");
  await editor.click();
  await expect(editor).toBeFocused();
  await page.keyboard.type(title);
  await page.keyboard.press("Enter");

  const tab = page.getByTestId("tab-list").getByTestId("tab-item").first();
  await tab.click();
  await tab.getByTestId("tab-close").click();

  await page.getByTestId("note-list").getByText(title, { exact: true }).click();
  await expect(page.getByTestId("markdown-preview")).toBeVisible();
});
