import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

const slashMenuTimeoutMs = 1000;
const emptyLength = 0;
const taskListSelector = 'ul[data-type="taskList"]';

const resolveModifierKey = (): "Meta" | "Control" =>
  process.platform === "darwin" ? "Meta" : "Control";

const openSlashMenu = async (page: Page): Promise<void> => {
  const slashMenu = page.getByTestId("slash-menu");
  await page.keyboard.type("/");
  await slashMenu.waitFor({ state: "visible", timeout: slashMenuTimeoutMs });
};

const insertSlashBlock = async (
  page: Page,
  itemId: string,
  content: string
): Promise<void> => {
  await openSlashMenu(page);
  await page.getByTestId(`slash-menu-item-${itemId}`).click();
  if (content.length > emptyLength) {
    await page.keyboard.insertText(content);
  }
};

const insertChecklist = async (page: Page, content: string): Promise<void> => {
  await openSlashMenu(page);
  await page.getByTestId("slash-menu-item-checklist").click();
  const taskList = page.locator(taskListSelector);
  await expect(taskList).toBeVisible();
  const taskParagraph = taskList.locator("p").first();
  await taskParagraph.click();
  if (content.length > emptyLength) {
    await page.keyboard.insertText(content);
  }
};

test("create blocks and reload preserves structure", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  await page.getByTestId("new-note").click();

  const bodyEditor = page.getByTestId("note-body");
  await expect(bodyEditor).toBeVisible();
  await bodyEditor.click();

  await page.keyboard.type("## Reload heading");
  await page.keyboard.press("Enter");
  await insertChecklist(page, "Reload task");
  await expect(page.locator(taskListSelector)).toContainText("Reload task");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await insertSlashBlock(page, "code", "const foo = 1;");
  await page.keyboard.press(`${resolveModifierKey()}+Enter`);
  await page.keyboard.press("Enter");
  await page.keyboard.type("$$E = mc^2$$");
  await page.keyboard.press("Enter");

  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await page.reload();

  await expect(page.locator("h2")).toHaveText("Reload heading");
  await expect(page.locator(taskListSelector)).toBeVisible();
  await expect(page.locator("pre code")).toContainText("const foo = 1;");
  await expect(page.locator(".embervault-math-block")).toBeVisible();
});
