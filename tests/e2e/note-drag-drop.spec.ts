import { expect, test } from "@playwright/test";

const folderName = "Inbox";
const movedTitle = "Move Me";
const rootTitle = "Stay Root";
const reorderTitle = "Second In Folder";
const pollTimeoutMs = 10_000;
const persistDelayMs = 250;
const twoNotes = 2;
const firstIndex = 0;
const secondIndex = 1;
const emptyCount = 0;
const singleMatch = 1;
const noteListTestId = "note-list";
const projectsOverlayTestId = "projects-overlay";
const projectsToggleTestId = "projects-toggle";
const projectsAllNotesTestId = "projects-all-notes";
const metadataTabTestId = "right-panel-tab-metadata";
const metadataProjectSelectTestId = "metadata-project-select";

type NoteRowEntry = { id: string | null; title?: string };

test("moves notes to projects and persists order changes", async ({ page }) => {
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

  const createNote = async (title: string): Promise<void> => {
    await page.getByTestId("new-note").click();
    const bodyEditor = page.getByTestId("note-body");
    await bodyEditor.click();
    await expect(bodyEditor).toBeFocused();
    await page.keyboard.type(title);
    await page.keyboard.press("Enter");
    await expect(
      page.getByTestId(noteListTestId).getByText(title, { exact: true })
    ).toBeVisible();
  };

  const findNoteIdByTitle = async (title: string): Promise<string> => {
    const rows = page
      .getByTestId(noteListTestId)
      .locator('[data-testid^="note-row-"]');
    const entries: NoteRowEntry[] = await rows.evaluateAll(
      (elements: Element[]) =>
        elements.map((element: Element) => ({
          id: element.getAttribute("data-note-id"),
          title: element.querySelector(".note-row-title")?.textContent?.trim(),
        }))
    );
    const match = entries.find((entry: NoteRowEntry) => entry.title === title);
    if (!match?.id) {
      throw new Error(`Missing note row for ${title}`);
    }
    return match.id;
  };

  const readNoteOrder = async (): Promise<string[]> => {
    const rows = page
      .getByTestId(noteListTestId)
      .locator('[data-testid^="note-row-"]');
    const ids = await rows.evaluateAll((elements: Element[]) =>
      elements.map((element: Element) => element.getAttribute("data-note-id"))
    );
    const resolved = ids.filter((id): id is string => typeof id === "string");
    if (resolved.length !== ids.length) {
      throw new Error("Missing note ids");
    }
    return resolved;
  };

  const moveOpenNoteToProject = async (projectLabel: string): Promise<void> => {
    await page.getByTestId(metadataTabTestId).click();
    await page
      .getByTestId(metadataProjectSelectTestId)
      .selectOption({ label: projectLabel });
  };

  await createFolder(folderName);
  await createNote(movedTitle);
  await createNote(rootTitle);

  const movedId = await findNoteIdByTitle(movedTitle);
  await page.getByTestId(`note-row-${movedId}`).click();
  await moveOpenNoteToProject(folderName);

  await openProjects();
  const folderRow = page.locator('[data-testid^="folder-row-"]', {
    hasText: folderName,
  });
  await folderRow.click();

  const noteList = page.getByTestId(noteListTestId);
  await expect
    .poll(() => noteList.getByText(movedTitle, { exact: true }).count(), {
      timeout: pollTimeoutMs,
    })
    .toBe(singleMatch);
  await expect(noteList.getByText(rootTitle, { exact: true })).toHaveCount(
    emptyCount
  );

  await createNote(reorderTitle);

  await expect.poll(readNoteOrder).toHaveLength(twoNotes);
  const orderBefore = await readNoteOrder();

  const draggedId = orderBefore[secondIndex];
  const dropTargetId = orderBefore[firstIndex];
  const draggedReorder = page.getByTestId(`note-row-${draggedId}`);
  const dropTarget = page.getByTestId(`note-row-${dropTargetId}`);
  await draggedReorder.dragTo(dropTarget);

  const orderAfter = await readNoteOrder();
  expect(orderAfter[firstIndex]).toBe(draggedId);

  await page.waitForTimeout(persistDelayMs);
  await page.reload();
  await openProjects();
  await folderRow.click();
  const persistedOrder = await readNoteOrder();
  expect(persistedOrder[firstIndex]).toBe(draggedId);
});
