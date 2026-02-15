import { expect, test } from "@playwright/test";

test("import from folder creates a note from markdown", async ({ page }) => {
  await page.addInitScript(() => {
    const markdown = "# Imported note\n\nHello from import";

    const fileHandle = {
      kind: "file",
      name: "imported.md",
      getFile() {
        return new File([markdown], "imported.md", { type: "text/markdown" });
      },
    };

    const directoryHandle = {
      kind: "directory",
      name: "ImportRoot",
      values() {
        return (async function* values() {
          yield fileHandle as unknown as FileSystemHandle;
        })();
      },
      getDirectoryHandle() {
        throw Object.assign(new Error("Not found"), {
          name: "NotFoundError",
        });
      },
    };

    (
      globalThis as unknown as {
        showDirectoryPicker?: () => unknown;
      }
    ).showDirectoryPicker = () => directoryHandle;
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  await page.getByTestId("open-settings").click();
  await page.getByRole("button", { name: "Import/Export" }).click();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByRole("button", { name: "Close settings" }).click();

  await expect(page.getByTestId("note-list")).toContainText("Imported note");
});
