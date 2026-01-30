import { expect, test } from "@playwright/test";

const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5V0f8AAAAASUVORK5CYII=";

test("paste image inserts an image block", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/.+/);

  await page.getByTestId("new-note").click();

  const editor = page.getByTestId("note-body");
  await editor.click();
  await page.waitForFunction(() => {
    const target = document.querySelector('[data-testid="note-body"]');
    return target instanceof HTMLElement && target.isContentEditable;
  });

  await page.evaluate(
    async ([base64]) => {
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
      const blob = new Blob([bytes], { type: "image/png" });
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
        detail: { bytes: bytesArray, mime: "image/png" },
        bubbles: true,
        cancelable: true,
      });
      const target = document.querySelector(".editor-mount");
      target?.dispatchEvent(event);
    },
    [pngBase64]
  );

  const image = page.locator("img[data-asset-id]");
  await expect(image).toBeVisible({ timeout: 10_000 });
  await expect(image).toHaveAttribute("data-asset-id", /[\da-f]{64}/);
});
