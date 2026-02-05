import { test, expect } from "@playwright/test";

/* eslint-disable compat/compat */

test.describe("offline", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Service worker offline behavior is validated in Chromium (FS Access primary engine)."
  );

  test("loads onboarding while offline after first load", async ({
    page,
    context,
  }) => {
    await page.goto("/onboarding");

    // Ensure the service worker is installed.
    await page.evaluate(() => navigator.serviceWorker.ready);

    // Ensure the SW is controlling the page (usually requires a reload after install).
    await page.reload();
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null
    );

    await expect(page.getByTestId("use-browser-storage")).toBeVisible();

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByTestId("use-browser-storage")).toBeVisible();
  });
});
