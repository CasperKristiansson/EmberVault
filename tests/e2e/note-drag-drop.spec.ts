import { expect, test } from "@playwright/test";

test("drags notes to folders and persists order", async ({ page }) => {
  const folderName = "Inbox";
  const movedTitle = "Move Me";
  const rootTitle = "Stay Root";
  const reorderTitle = "Second In Folder";
  const treeMenuOffset = 8;
  const twoNotes = 2;
  const firstIndex = 0;
  const secondIndex = 1;
  const emptyCount = 0;
  type NoteRowEntry = { id: string | null; title?: string };

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

  const createNote = async (title: string): Promise<void> => {
    await page.getByTestId("new-note").click();
    await page.getByTestId("note-title").fill(title);
    await expect(
      page.getByTestId("note-list").getByText(title, { exact: true })
    ).toBeVisible();
  };

  const findNoteIdByTitle = async (title: string): Promise<string> => {
    const rows = page
      .getByTestId("note-list")
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
      .getByTestId("note-list")
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

  await createFolder(folderName);

  await createNote(movedTitle);
  await createNote(rootTitle);

  const movedId = await findNoteIdByTitle(movedTitle);

  const draggedRow = page.getByTestId(`note-row-${movedId}`);
  const folderRow = page.locator('[data-testid^="folder-row-"]', {
    hasText: folderName,
  });

  await draggedRow.dispatchEvent("dragstart");
  await folderRow.dispatchEvent("dragover");
  await folderRow.dispatchEvent("drop");
  await draggedRow.dispatchEvent("dragend");

  await folderRow.click();
  const noteList = page.getByTestId("note-list");
  await expect(noteList.getByText(movedTitle, { exact: true })).toBeVisible();
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

  await draggedReorder.dispatchEvent("dragstart");
  await dropTarget.dispatchEvent("dragover");
  await dropTarget.dispatchEvent("drop");
  await draggedReorder.dispatchEvent("dragend");

  const orderAfter = await readNoteOrder();
  expect(orderAfter[firstIndex]).toBe(draggedId);

  await page.reload();
  await folderRow.click();
  const persistedOrder = await readNoteOrder();
  expect(persistedOrder[firstIndex]).toBe(draggedId);
});
