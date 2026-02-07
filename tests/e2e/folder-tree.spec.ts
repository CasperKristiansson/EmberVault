import { expect, test } from "@playwright/test";

test("create, rename, and delete an empty folder", async ({ page }) => {
  const emptyCount = 0;
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  await page.getByTestId("folder-add").click();

  const nameInput = page.getByTestId("folder-rename-input");
  await expect(nameInput).toBeVisible();
  await nameInput.fill("Projects");
  await nameInput.press("Enter");

  const projectsRow = page.locator('[data-testid^="folder-row-"]', {
    hasText: "Projects",
  });
  await expect(projectsRow).toBeVisible();
  await expect(projectsRow.getByTestId("folder-icon")).toBeVisible();
  await expect(projectsRow.locator('input[type="checkbox"]')).toHaveCount(
    emptyCount
  );

  await page.getByText("Projects", { exact: true }).click({ button: "right" });
  await page.getByTestId("folder-menu-rename").click();

  const renameInput = page.getByTestId("folder-rename-input");
  await renameInput.fill("Archive");
  await renameInput.press("Enter");

  await expect(page.getByText("Archive", { exact: true })).toBeVisible();

  await page.getByText("Archive", { exact: true }).click({ button: "right" });
  await page.getByTestId("folder-menu-delete").click();

  await expect(page.getByText("Archive", { exact: true })).toHaveCount(
    emptyCount
  );
});
