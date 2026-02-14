import { expect, test } from "@playwright/test";

test("interface density changes list row height", async ({ page }) => {
  const viewWidth = 1280;
  const viewHeight = 800;
  const comfortableRowHeight = 34;
  const compactRowHeight = 32;
  const heightTolerance = 1;

  await page.setViewportSize({ width: viewWidth, height: viewHeight });
  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  await page.getByTestId("new-note").click();

  const row = page.locator('[data-testid^="note-row-"]').first();
  const readHeight = (): Promise<number> =>
    // eslint-disable-next-line sonarjs/arrow-function-convention
    row.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).height)
    );

  const initialHeight = await readHeight();
  expect(Math.abs(initialHeight - comfortableRowHeight)).toBeLessThanOrEqual(
    heightTolerance
  );

  await page.getByTestId("open-settings").click();
  await expect(page.getByTestId("settings-modal")).toBeVisible();
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByRole("button", { name: "Compact" }).click();
  await page.getByRole("button", { name: "Close settings" }).click();

  const compactHeight = await readHeight();
  expect(Math.abs(compactHeight - compactRowHeight)).toBeLessThanOrEqual(
    heightTolerance
  );
});
