/* eslint-disable sonarjs/arrow-function-convention */
import { expect, test } from "@playwright/test";

const paneTextMustInclude = (value: string, panesText: string[]): void => {
  if (!panesText.some((text) => text.includes(value))) {
    throw new Error(`Expected a pane to include: ${value}`);
  }
};

test("docks notes into multiple panes via drag and drop and persists layout", async ({
  page,
}) => {
  const viewportWidth = 1280;
  const viewportHeight = 800;
  const tabCount = 4;
  const paneCountInitial = 1;
  const paneCountAfterFirstDock = 2;
  const paneCountAfterSecondDock = 3;
  const paneCountAfterThirdDock = 4;
  const paneIndexLeft = 0;
  const paneIndexRight = 1;
  const paneIndexMiddle = 1;
  const edgeOffsetPx = 6;
  const topOffsetPx = 5;
  const halfDivisor = 2;
  const testIdNewNote = "new-note";
  const testIdTabList = "tab-list";
  const testIdTabItem = "tab-item";
  const testIdEditorPaneLeaf = "editor-pane-leaf";
  const noteIdAttribute = "data-note-id";

  await page.setViewportSize({ width: viewportWidth, height: viewportHeight });
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  const titles = ["Dock One", "Dock Two", "Dock Three", "Dock Four"] as const;
  const [titleOne, titleTwo, titleThree, titleFour] = titles;
  const missingPaneBoxMessage = "Missing pane bounding box";

  const createNote = async (title: string): Promise<void> => {
    await page.getByTestId(testIdNewNote).click();
    const bodyEditor = page.getByTestId("note-body");
    await bodyEditor.click();
    await expect(bodyEditor).toBeFocused();
    await page.keyboard.type(title);
    await page.keyboard.press("Enter");
    await expect(
      page.getByTestId("note-list").getByText(title, { exact: true })
    ).toBeVisible();
  };

  await createNote(titleOne);
  await createNote(titleTwo);
  await createNote(titleThree);
  await createNote(titleFour);

  const tabItems = page.getByTestId(testIdTabList).getByTestId(testIdTabItem);
  await expect(tabItems).toHaveCount(tabCount);

  const ids = await tabItems.evaluateAll(
    (elements, attributeName) =>
      elements.map((element) => element.getAttribute(attributeName)),
    noteIdAttribute
  );
  const resolved = ids.filter((id) => typeof id === "string") as string[];
  if (resolved.length !== ids.length) {
    throw new Error("Missing tab ids");
  }
  const [idOne, idTwo, idThree, idFour] = resolved;
  if (!idOne || !idTwo || !idThree || !idFour) {
    throw new Error("Missing tab ids");
  }

  const panes = page.getByTestId(testIdEditorPaneLeaf);
  await expect(panes).toHaveCount(paneCountInitial);

  // Dock "Two" to the right edge of the only pane.
  const firstPane = panes.first();
  const firstBox = await firstPane.boundingBox();
  if (!firstBox) {
    throw new Error(missingPaneBoxMessage);
  }
  await page
    .locator(`[data-testid="${testIdTabItem}"][data-note-id="${idTwo}"]`)
    .dragTo(firstPane, {
      targetPosition: {
        x: Math.floor(firstBox.width - edgeOffsetPx),
        y: Math.floor(firstBox.height / halfDivisor),
      },
    });

  await expect(panes).toHaveCount(paneCountAfterFirstDock);

  // Activate the left pane so the remaining tabs show in the tab strip.
  await panes.nth(paneIndexLeft).click();

  // Dock "Three" to the right edge of the right pane (creating a third pane).
  const rightPane = panes.nth(paneIndexRight);
  const rightBox = await rightPane.boundingBox();
  if (!rightBox) {
    throw new Error(missingPaneBoxMessage);
  }
  await page
    .locator(`[data-testid="${testIdTabItem}"][data-note-id="${idThree}"]`)
    .dragTo(rightPane, {
      targetPosition: {
        x: Math.floor(rightBox.width - edgeOffsetPx),
        y: Math.floor(rightBox.height / halfDivisor),
      },
    });

  await expect(panes).toHaveCount(paneCountAfterSecondDock);

  // Activate the leftmost pane and dock "One" above the middle pane.
  await panes.nth(paneIndexLeft).click();
  const middlePane = panes.nth(paneIndexMiddle);
  const middleBox = await middlePane.boundingBox();
  if (!middleBox) {
    throw new Error(missingPaneBoxMessage);
  }
  await page
    .locator(`[data-testid="${testIdTabItem}"][data-note-id="${idOne}"]`)
    .dragTo(middlePane, {
      targetPosition: {
        x: Math.floor(middleBox.width / halfDivisor),
        y: topOffsetPx,
      },
    });

  await expect(panes).toHaveCount(paneCountAfterThirdDock);

  const paneTexts = await panes
    .locator('[data-testid="note-body"]')
    .evaluateAll((elements) =>
      elements
        .map((element) => element.textContent ?? "")
        .map((text) => text.trim())
    );

  paneTextMustInclude(titleOne, paneTexts);
  paneTextMustInclude(titleTwo, paneTexts);
  paneTextMustInclude(titleThree, paneTexts);
  paneTextMustInclude(titleFour, paneTexts);

  await page.reload();

  await expect(page.getByTestId(testIdEditorPaneLeaf)).toHaveCount(
    paneCountAfterThirdDock
  );
});
