import { expect, test } from "@playwright/test";

test("creates notes in folders and filters the list", async ({ page }) => {
  const emptyCount = 0;
  const workNoteTitle = "Work Note";
  const personalNoteTitle = "Personal Note";
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);
  await expect(page.getByTestId("new-note")).toBeEnabled();

  const openProjects = async (): Promise<void> => {
    await page.getByTestId("projects-toggle").click();
    await expect(page.getByTestId("projects-overlay")).toBeVisible();
  };

  const closeProjects = async (): Promise<void> => {
    await page.getByTestId("projects-close").click();
    await expect(page.getByTestId("projects-overlay")).toHaveCount(emptyCount);
  };

  await openProjects();
  const tree = page.getByTestId("folder-tree");
  const noteListTitle = page.getByTestId("note-list-title");

  const createFolder = async (name: string): Promise<void> => {
    await page.getByTestId("folder-add").click();
    const input = page.getByTestId("folder-rename-input");
    await input.fill(name);
    await input.press("Enter");
    await expect(tree.getByText(name, { exact: true })).toBeVisible();
  };

  await createFolder("Work");
  await createFolder("Personal");

  await closeProjects();

  await openProjects();
  await tree.getByText("Work", { exact: true }).click();
  await expect(noteListTitle).toHaveText("Work");
  await page.getByTestId("new-note").click();
  const bodyEditor = page.getByTestId("note-body");
  await bodyEditor.click();
  await expect(bodyEditor).toBeFocused();
  await page.keyboard.type(workNoteTitle);
  await page.keyboard.press("Enter");
  await expect(
    page.getByTestId("note-list").getByText(workNoteTitle, { exact: true })
  ).toBeVisible();

  await openProjects();
  await tree.getByText("Personal", { exact: true }).click();
  await expect(noteListTitle).toHaveText("Personal");
  await page.getByTestId("new-note").click();
  await bodyEditor.click();
  await expect(bodyEditor).toBeFocused();
  await page.keyboard.type(personalNoteTitle);
  await page.keyboard.press("Enter");
  await expect(
    page.getByTestId("note-list").getByText(personalNoteTitle, { exact: true })
  ).toBeVisible();

  await openProjects();
  await tree.getByText("Work", { exact: true }).click();
  await expect(noteListTitle).toHaveText("Work");

  const noteList = page.getByTestId("note-list");
  await expect(
    noteList.getByText(workNoteTitle, { exact: true })
  ).toBeVisible();
  await expect(
    noteList.getByText(personalNoteTitle, { exact: true })
  ).toHaveCount(emptyCount);

  await openProjects();
  await page.getByTestId("projects-all-notes").click();
  await expect(noteListTitle).toHaveText("All notes");
  await expect(
    noteList.getByText(workNoteTitle, { exact: true })
  ).toBeVisible();
  await expect(
    noteList.getByText(personalNoteTitle, { exact: true })
  ).toBeVisible();
});
