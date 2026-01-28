import { expect, test } from "@playwright/test";

test("creates notes in folders and filters the list", async ({ page }) => {
  const emptyCount = 0;
  const treeMenuOffset = 8;
  const workNoteTitle = "Work Note";
  const personalNoteTitle = "Personal Note";
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/.+/);
  await expect(page.getByTestId("new-note")).toBeEnabled();

  const tree = page.getByTestId("folder-tree");

  const createFolder = async (name: string): Promise<void> => {
    const treeBounds = await tree.boundingBox();
    if (!treeBounds) {
      throw new Error("Folder tree not available");
    }
    await page.mouse.click(
      treeBounds.x + treeMenuOffset,
      treeBounds.y + treeBounds.height - treeMenuOffset,
      { button: "right" }
    );
    await page.getByTestId("folder-menu-new").click();
    const input = page.getByTestId("folder-rename-input");
    await input.fill(name);
    await input.press("Enter");
    await expect(tree.getByText(name, { exact: true })).toBeVisible();
  };

  await createFolder("Work");
  await createFolder("Personal");

  await tree.getByText("Work", { exact: true }).click();
  await page.getByTestId("new-note").click();
  await page.getByTestId("note-title").fill(workNoteTitle);
  await expect(
    page.getByTestId("note-list").getByText(workNoteTitle, { exact: true })
  ).toBeVisible();

  await tree.getByText("Personal", { exact: true }).click();
  await page.getByTestId("new-note").click();
  await page.getByTestId("note-title").fill(personalNoteTitle);
  await expect(
    page.getByTestId("note-list").getByText(personalNoteTitle, { exact: true })
  ).toBeVisible();

  await tree.getByText("Work", { exact: true }).click();

  await expect(page.getByText(workNoteTitle, { exact: true })).toBeVisible();
  await expect(page.getByText(personalNoteTitle, { exact: true })).toHaveCount(
    emptyCount
  );
});
