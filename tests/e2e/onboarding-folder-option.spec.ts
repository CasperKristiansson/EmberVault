import { test, expect } from "@playwright/test";

const emptyCount = 0;

test("onboarding shows folder option when supported", async ({ page }) => {
  await page.addInitScript(() => {
    type GlobalWithPicker = typeof globalThis & {
      showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    };
    const globalWithPicker: GlobalWithPicker = globalThis;
    // eslint-disable-next-line require-await
    globalWithPicker.showDirectoryPicker = async () => {
      throw new DOMException("User cancelled", "AbortError");
    };
  });

  await page.goto("/onboarding");

  await expect(page.getByTestId("use-folder-storage")).toBeVisible();
  await expect(page.getByTestId("use-browser-storage")).toBeVisible();
  await expect(
    page.locator("text=Your browser doesn't support folder storage.")
  ).toHaveCount(emptyCount);
});
