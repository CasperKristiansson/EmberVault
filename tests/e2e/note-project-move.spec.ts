import { expect, test } from "@playwright/test";

const workFolderName = "Work";
const personalFolderName = "Personal";
const noteTitle = "Project Move Note";
const emptyCount = 0;
const projectsOverlayTestId = "projects-overlay";
const projectsToggleTestId = "projects-toggle";
const projectsAllNotesTestId = "projects-all-notes";
const metadataTabTestId = "right-panel-tab-metadata";
const metadataProjectSelectTestId = "metadata-project-select";
const noteListTestId = "note-list";

test("moves notes from unassigned into projects and between projects", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await expect(page.getByTestId("new-note")).toBeEnabled();

  const openProjects = async (): Promise<void> => {
    await page.getByTestId(projectsToggleTestId).click();
    await expect(page.getByTestId(projectsOverlayTestId)).toBeVisible();
  };

  const closeProjectsToAllNotes = async (): Promise<void> => {
    await page.getByTestId(projectsAllNotesTestId).click();
    await expect(page.getByTestId(projectsOverlayTestId)).toHaveCount(
      emptyCount
    );
  };

  const createFolder = async (name: string): Promise<void> => {
    await openProjects();
    const tree = page.getByTestId("folder-tree");
    await page.getByTestId("folder-add").click();
    const input = page.getByTestId("folder-rename-input");
    await input.fill(name);
    await input.press("Enter");
    await expect(tree.getByText(name, { exact: true })).toBeVisible();
    await closeProjectsToAllNotes();
  };

  const openFolder = async (name: string): Promise<void> => {
    await openProjects();
    const folderRow = page.locator('[data-testid^="folder-row-"]', {
      hasText: name,
    });
    await folderRow.click();
  };

  const moveActiveNoteToProject = async (
    projectName: string
  ): Promise<void> => {
    await page.getByTestId(metadataTabTestId).click();
    await page
      .getByTestId(metadataProjectSelectTestId)
      .selectOption({ label: projectName });
  };

  await createFolder(workFolderName);
  await createFolder(personalFolderName);

  await page.getByTestId("new-note").click();
  const bodyEditor = page.getByTestId("note-body");
  await bodyEditor.click();
  await expect(bodyEditor).toBeFocused();
  await page.keyboard.type(noteTitle);
  await page.keyboard.press("Enter");

  await moveActiveNoteToProject(workFolderName);
  await openFolder(workFolderName);
  const noteList = page.getByTestId(noteListTestId);
  await expect(noteList.getByText(noteTitle, { exact: true })).toBeVisible();

  await noteList
    .locator('[data-testid^="note-row-"]', {
      hasText: noteTitle,
    })
    .click();
  await moveActiveNoteToProject(personalFolderName);

  await openFolder(workFolderName);
  await expect(noteList.getByText(noteTitle, { exact: true })).toHaveCount(
    emptyCount
  );
  await openFolder(personalFolderName);
  await expect(noteList.getByText(noteTitle, { exact: true })).toBeVisible();
});
