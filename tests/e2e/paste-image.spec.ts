import { expect, test } from "@playwright/test";

const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5V0f8AAAAASUVORK5CYII=";
const noteBodyTestId = "note-body";
const pngMime = "image/png";
const noteBodySelector = `[data-testid="${noteBodyTestId}"]`;

const isContentEditable = function isContentEditable(
  selector: string
): boolean {
  const target = document.querySelector(selector);
  return target instanceof HTMLElement && target.isContentEditable;
};

test("paste image inserts an image block", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/.+/);

  await page.getByTestId("new-note").click();

  const editor = page.getByTestId(noteBodyTestId);
  await editor.click();
  await page.waitForFunction(isContentEditable, noteBodySelector);

  await page.evaluate(
    async ([base64, mime, selector]) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      const startIndex = 0;
      const step = 1;
      for (let index = startIndex; index < binary.length; index += step) {
        const codePoint = binary.codePointAt(index);
        if (typeof codePoint === "number") {
          bytes[index] = codePoint;
        }
      }
      const blob = new Blob([bytes], { type: mime });
      // eslint-disable-next-line no-unused-vars
      type PasteImageHandler = (blob: Blob) => Promise<void>;
      const pasteHandler = (
        globalThis as {
          embervaultPasteImage?: PasteImageHandler;
        }
      ).embervaultPasteImage;
      if (typeof pasteHandler === "function") {
        await pasteHandler(blob);
        return;
      }
      const bytesArray = [...bytes];
      const event = new CustomEvent("embervault-paste-image", {
        detail: { bytes: bytesArray, mime },
        bubbles: true,
        cancelable: true,
      });
      const target = document.querySelector(selector);
      target?.dispatchEvent(event);
    },
    [pngBase64, pngMime, ".editor-mount"]
  );

  const image = page.locator("img[data-asset-id]");
  await expect(image).toBeVisible({ timeout: 10_000 });
  await expect(image).toHaveAttribute("data-asset-id", /[\da-f]{64}/);
});

test("drag-drop image inserts an image block", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/.+/);

  await page.getByTestId("new-note").click();

  const editor = page.getByTestId(noteBodyTestId);
  await editor.click();
  await page.waitForFunction(isContentEditable, noteBodySelector);

  await page.evaluate(
    ([base64, mime, selector]) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      const startIndex = 0;
      const step = 1;
      for (let index = startIndex; index < binary.length; index += step) {
        const codePoint = binary.codePointAt(index);
        if (typeof codePoint === "number") {
          bytes[index] = codePoint;
        }
      }
      const file = new File([bytes], "drag.png", { type: mime });
      const dataTransfer = {
        items: [
          {
            kind: "file",
            type: mime,
            getAsFile: () => file,
          },
        ],
        files: [file],
      };
      const event = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
      const target = document.querySelector(selector);
      target?.dispatchEvent(event);
    },
    [pngBase64, pngMime, noteBodySelector]
  );

  const image = page.locator("img[data-asset-id]");
  await expect(image).toBeVisible({ timeout: 10_000 });
  await expect(image).toHaveAttribute("data-asset-id", /[\da-f]{64}/);
});
