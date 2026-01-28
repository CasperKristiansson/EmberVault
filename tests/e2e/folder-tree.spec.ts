import { expect, test } from "@playwright/test";

test("create, rename, and delete an empty folder", async ({ page }) => {
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/.+/);

  const tree = page.getByTestId("folder-tree");
  await tree.click({ button: "right" });
  await page.getByTestId("folder-menu-new").click();

  const nameInput = page.getByTestId("folder-rename-input");
  await expect(nameInput).toBeVisible();
  await nameInput.fill("Projects");
  await nameInput.press("Enter");

  await expect(page.getByText("Projects", { exact: true })).toBeVisible();

  await page.getByText("Projects", { exact: true }).click({ button: "right" });
  await page.getByTestId("folder-menu-rename").click();

  const renameInput = page.getByTestId("folder-rename-input");
  await renameInput.fill("Archive");
  await renameInput.press("Enter");

  await expect(page.getByText("Archive", { exact: true })).toBeVisible();

  await page.getByText("Archive", { exact: true }).click({ button: "right" });
  await page.getByTestId("folder-menu-delete").click();

  const emptyCount = 0;
  await expect(page.getByText("Archive", { exact: true })).toHaveCount(
    emptyCount
  );
});
