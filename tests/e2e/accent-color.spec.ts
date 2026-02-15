import { expect, test } from "@playwright/test";

test("accent color changes CSS accent tokens", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await expect(page).toHaveURL(/\/app\/?$/);

  const readAccent0 = (): Promise<string> =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent-0")
        .trim()
        .toLowerCase()
    );

  const readDataAccent = (): Promise<string> =>
    page.evaluate(
      () => document.documentElement.getAttribute("data-accent") ?? ""
    );

  expect(await readAccent0()).toBe("#ff8a2a");
  expect(await readDataAccent()).toBe("");

  await page.getByTestId("open-settings").click();
  await expect(page.getByTestId("settings-modal")).toBeVisible();
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByRole("button", { name: "Sky" }).click();
  await page.getByRole("button", { name: "Close settings" }).click();

  expect(await readAccent0()).toBe("#3ea6ff");
  expect(await readDataAccent()).toBe("sky");

  await page.getByTestId("open-settings").click();
  await expect(page.getByTestId("settings-modal")).toBeVisible();
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByRole("button", { name: "Orange" }).click();
  await page.getByRole("button", { name: "Close settings" }).click();

  expect(await readAccent0()).toBe("#ff8a2a");
  expect(await readDataAccent()).toBe("");
});
