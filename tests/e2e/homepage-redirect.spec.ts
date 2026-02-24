import { expect, test } from "@playwright/test";
import { enterBrowserStorageApp } from "./helpers/enter-browser-storage-app";

const homepageUrlPattern = /^https?:\/\/[^/]+\/(?:\?.*)?$/;

test("returning users auto-open the app and can navigate to homepage from projects", async ({
  page,
}) => {
  await enterBrowserStorageApp(page);
  await expect(page.getByTestId("note-list-title")).toBeVisible();

  await page.goto("/");
  await expect(page).toHaveURL(/\/app\/?$/);

  await page.getByTestId("projects-toggle").click();
  await page.getByTestId("projects-home").click();

  await expect(page).toHaveURL(homepageUrlPattern);
  await expect(
    page.getByRole("heading", { name: "Local-first. No accounts. No cloud." })
  ).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/app\/?$/);
});
