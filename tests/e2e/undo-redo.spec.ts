import { expect, test } from "@playwright/test";

const getModifier = (): "Meta" | "Control" =>
  process.platform === "darwin" ? "Meta" : "Control";

test("undo and redo edits", async ({ page }) => {
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  await page.getByTestId("new-note").click();

  const bodyEditor = page.getByTestId("note-body");
  await bodyEditor.click();
  await page.keyboard.type("Undo me");

  await expect(bodyEditor).toContainText("Undo me");

  const modifier = getModifier();
  await page.keyboard.press(`${modifier}+Z`);
  await expect(bodyEditor).not.toContainText("Undo me");

  await page.keyboard.press(`Shift+${modifier}+Z`);
  await expect(bodyEditor).toContainText("Undo me");
});
