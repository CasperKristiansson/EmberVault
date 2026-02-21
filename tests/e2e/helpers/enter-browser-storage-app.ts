import { expect } from "@playwright/test";

const APP_URL_PATTERN = /\/app\/?$/;
const ONBOARDING_URL_PATTERN = /\/onboarding\/?$/;
const ONBOARDING_TO_APP_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_COUNT = 1;
const NO_RETRIES = 0;

const clickBrowserStorageAndWaitForApp = async (
  page: import("@playwright/test").Page
): Promise<void> => {
  await page.getByTestId("use-browser-storage").click();
  await expect(page).toHaveURL(APP_URL_PATTERN, {
    timeout: ONBOARDING_TO_APP_TIMEOUT_MS,
  });
};

export const enterBrowserStorageApp = async (
  page: import("@playwright/test").Page,
  retries = DEFAULT_RETRY_COUNT
): Promise<void> => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(ONBOARDING_URL_PATTERN);

  try {
    await clickBrowserStorageAndWaitForApp(page);
    return;
  } catch (error) {
    if (retries === NO_RETRIES) {
      throw error;
    }
  }

  await page.reload();
  await expect(page).toHaveURL(ONBOARDING_URL_PATTERN);
  await clickBrowserStorageAndWaitForApp(page);
};
