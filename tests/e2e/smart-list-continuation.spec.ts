import { expect, test } from "@playwright/test";

test("smart list continuation continues markdown markers in code blocks", async ({
  page,
}) => {
  const title = "Smart list";
  const viewWidth = 1280;
  const viewHeight = 800;
  const hiddenCount = 0;

  await page.setViewportSize({ width: viewWidth, height: viewHeight });
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  await page.getByTestId("open-settings").click();
  await expect(page.getByTestId("settings-modal")).toBeVisible();
  await page.getByRole("button", { name: "Editor" }).click();
  await page.getByRole("button", { name: "Smart list continuation" }).click();
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(page.getByTestId("settings-modal")).toHaveCount(hiddenCount);

  await page.getByTestId("new-note").click();
  await page.getByTestId("toggle-markdown-view").click();

  const editor = page.getByTestId("note-body");
  await editor.click();
  await expect(editor).toBeFocused();
  await page.keyboard.type(title);
  await page.keyboard.press("Enter");

  await page.keyboard.type("/code");
  await page.keyboard.press("Enter");

  await page.keyboard.type("- item");
  await page.keyboard.press("Enter");

  const codeText = await page
    .locator('[data-testid="note-body"] pre code')
    .first()
    .textContent();

  expect(codeText ?? "").toContain("- item\n- ");
});
