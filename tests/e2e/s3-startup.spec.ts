/* eslint-disable promise/avoid-new, compat/compat, sonarjs/arrow-function-convention */
import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;
type S3Mode = "success" | "fail" | "slow";

const connectS3Label = "Connect S3";
const slowModeDelayMs = 900;
const accessDeniedStatus = 403;
const notFoundStatus = 404;
const okStatus = 200;
const missingIndex = -1;
const onboardingSkipMessage =
  "Playwright WebKit does not reliably support the Web APIs needed for S3 onboarding in this test harness.";

const waitForDelay = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

const extractObjectKey = (url: string): string => {
  const schemeDelimiter = "://";
  const schemeIndex = url.indexOf(schemeDelimiter);
  const pathIndex =
    schemeIndex === missingIndex
      ? url.indexOf("/")
      : url.indexOf("/", schemeIndex + schemeDelimiter.length);
  const path = pathIndex === missingIndex ? "/" : url.slice(pathIndex);
  const [pathWithoutQuery] = path.split("?");
  return pathWithoutQuery.replace(/^\/+/, "");
};

const fillS3Form = async (page: Page): Promise<void> => {
  await page.getByLabel("Bucket").fill("s3://bucket-startup");
  await page.getByLabel("Region").fill("eu-north-1");
  await page.getByLabel("Prefix (optional)").fill("embervault/");
  await page.getByLabel("Access key ID").fill("AKIA_STARTUP_TEST");
  await page.getByLabel("Secret access key").fill("SECRET_STARTUP_TEST");
};

const mockS3WithModeSwitch = async (page: Page) => {
  const objects = new Map<string, string>();
  let mode: S3Mode = "success";

  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!request.url().includes("amazonaws.com")) {
      await route.continue();
      return;
    }

    if (mode === "fail") {
      await route.fulfill({
        status: accessDeniedStatus,
        contentType: "application/xml",
        body: '<?xml version="1.0" encoding="UTF-8"?><Error><Code>AccessDenied</Code><Message>Forbidden</Message></Error>',
      });
      return;
    }

    if (mode === "slow") {
      await waitForDelay(slowModeDelayMs);
    }

    const key = extractObjectKey(request.url());
    if (request.method() === "GET") {
      const stored = objects.get(key);
      if (!stored) {
        await route.fulfill({
          status: notFoundStatus,
          contentType: "application/xml",
          body: '<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code><Message>Not Found</Message></Error>',
        });
        return;
      }
      await route.fulfill({
        status: okStatus,
        contentType: "application/json",
        body: stored,
      });
      return;
    }

    if (request.method() === "PUT") {
      objects.set(key, request.postData() ?? "");
      await route.fulfill({ status: okStatus, body: "" });
      return;
    }

    if (request.method() === "DELETE") {
      objects.delete(key);
      await route.fulfill({ status: okStatus, body: "" });
      return;
    }

    await route.fulfill({ status: okStatus, body: "" });
  });

  return {
    setMode: (nextMode: S3Mode) => {
      mode = nextMode;
    },
  };
};

test("s3 startup failure exposes recovery actions and retry can recover", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", onboardingSkipMessage);
  const { setMode } = await mockS3WithModeSwitch(page);

  await page.goto("/onboarding");
  await fillS3Form(page);
  await page.getByRole("button", { name: connectS3Label }).click();
  await expect(page).toHaveURL(/\/app\/?$/);

  setMode("fail");
  await page.reload();

  const startupOverlay = page.getByTestId("s3-startup-overlay");
  await expect(startupOverlay).toBeVisible();
  await expect(page.getByTestId("retry-s3-startup")).toBeVisible();
  await expect(page.getByTestId("back-to-onboarding")).toBeVisible();

  setMode("success");
  await page.getByTestId("retry-s3-startup").click();
  await expect(page.getByTestId("note-list-title")).toBeVisible();
  await expect(startupOverlay).toBeHidden();
});

test("s3 startup shows staged overlay while remote load is slow", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", onboardingSkipMessage);
  const { setMode } = await mockS3WithModeSwitch(page);

  await page.goto("/onboarding");
  await fillS3Form(page);
  await page.getByRole("button", { name: connectS3Label }).click();
  await expect(page).toHaveURL(/\/app\/?$/);

  setMode("slow");
  await page.reload();

  const startupOverlay = page.getByTestId("s3-startup-overlay");
  await expect(startupOverlay).toBeVisible();
  await expect(startupOverlay).toContainText(/Attempt [1-3] of 3/);
  await expect(page.getByTestId("note-list-title")).toBeVisible();
  await expect(startupOverlay).toBeHidden();
});
