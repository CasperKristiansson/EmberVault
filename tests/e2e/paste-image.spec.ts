import { expect, test } from "@playwright/test";

const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5V0f8AAAAASUVORK5CYII=";
const noteBodyTestId = "note-body";
const pngMime = "image/png";
const noteBodySelector = `[data-testid="${noteBodyTestId}"]`;
const captionText = "Caption text";
const onboardingPath = "/onboarding";
const useBrowserStorageTestId = "use-browser-storage";
const newNoteTestId = "new-note";
const imageSelector = "img[data-asset-id]";
const editorMountSelector = ".editor-mount";

const isContentEditable = function isContentEditable(
  selector: string
): boolean {
  const target = document.querySelector(selector);
  return target instanceof HTMLElement && target.isContentEditable;
};

test("paste image inserts an image block", async ({ page }) => {
  await page.goto(onboardingPath);
  await page.getByTestId(useBrowserStorageTestId).click();
  await page.waitForURL(/\/app\/.+/);

  await page.getByTestId(newNoteTestId).click();

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
    [pngBase64, pngMime, editorMountSelector]
  );

  const image = page.locator(imageSelector);
  await expect(image).toBeVisible({ timeout: 10_000 });
  await expect(image).toHaveAttribute("data-asset-id", /[\da-f]{64}/);
});

test("drag-drop image inserts an image block", async ({ page }) => {
  await page.goto(onboardingPath);
  await page.getByTestId(useBrowserStorageTestId).click();
  await page.waitForURL(/\/app\/.+/);

  await page.getByTestId(newNoteTestId).click();

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

  const image = page.locator(imageSelector);
  await expect(image).toBeVisible({ timeout: 10_000 });
  await expect(image).toHaveAttribute("data-asset-id", /[\da-f]{64}/);
});

test("image caption renders and opens lightbox", async ({ page }) => {
  await page.goto(onboardingPath);
  await page.getByTestId(useBrowserStorageTestId).click();
  await page.waitForURL(/\/app\/.+/);

  await page.getByTestId(newNoteTestId).click();

  const editor = page.getByTestId(noteBodyTestId);
  await editor.click();
  await page.waitForFunction(isContentEditable, noteBodySelector);

  await page.evaluate(
    async ([base64, mime]) => {
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
      }
    },
    [pngBase64, pngMime]
  );

  const caption = page.locator("figure.embervault-image figcaption");
  await caption.evaluate((node, text) => {
    node.textContent = text;
    node.dispatchEvent(new Event("input", { bubbles: true }));
  }, captionText);
  await expect(caption).toContainText(captionText);

  const image = page.locator(imageSelector);
  await image.click();

  const lightbox = page.getByTestId("image-lightbox");
  await expect(lightbox).toBeVisible();
  await expect(lightbox).toContainText(captionText);
});
