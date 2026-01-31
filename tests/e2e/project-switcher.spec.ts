import { expect, test } from "@playwright/test";

test("shows the project switcher for a single project", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding");

  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/.+/);

  const switcher = page.getByRole("combobox", { name: "Project switcher" });
  await expect(switcher).toHaveText(/Personal/);
  await expect(switcher).toBeDisabled();
  const selectedLabel = await switcher.evaluate(
    (element: HTMLSelectElement) =>
      element.options[element.selectedIndex]?.textContent ?? ""
  );
  expect(selectedLabel).toBe("Personal");
});
