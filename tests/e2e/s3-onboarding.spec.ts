import { expect, test } from "@playwright/test";

type Locator = import("@playwright/test").Locator;
type Page = import("@playwright/test").Page;

const onboardingPath = "/onboarding";
const appPathPattern = /\/app\/?$/;
const connectS3Label = "Connect S3";
const settingsModalTestId = "settings-modal";
const openSettingsTestId = "open-settings";
const storageSkipMessage =
  "Playwright WebKit does not reliably support the Web APIs needed for S3 storage tests.";
const onboardingSkipMessage =
  "Playwright WebKit does not reliably support the Web APIs needed for S3 onboarding in this test harness.";
const mockAccessKeyId = "AKIA_TEST";
const mockSecretAccessKey = "SECRET_TEST";
const vaultStorageKey = "embervault/vault.json";
const testDraftBucket = "s3://embervault";
const testDraftSessionToken = "SESSION_TOKEN";
const sessionTokenLabel = "Session token (optional)";
const singleLineSyncBadgePattern = /^[^\n]+: [^\n]+$/;

const extractObjectKey = (url: string): string => {
  const missingIndex = -1;
  const schemeDelimiter = "://";
  const schemeDelimiterLength = schemeDelimiter.length;
  const firstSegment = 0;

  const schemeIndex = url.indexOf(schemeDelimiter);
  const pathIndex =
    schemeIndex === missingIndex
      ? url.indexOf("/")
      : url.indexOf("/", schemeIndex + schemeDelimiterLength);
  const path = pathIndex === missingIndex ? "/" : url.slice(pathIndex);
  const pathWithoutQuery = path.split("?")[firstSegment] ?? path;
  return pathWithoutQuery.replace(/^\/+/, "");
};

const mockS3Network = async (page: Page): Promise<Map<string, string>> => {
  const objects = new Map<string, string>();

  // Route matching behaves differently across engines; use a catch-all route
  // and filter by URL to ensure WebKit is also intercepted.
  // Prettier enforces parens; Sonar suggests removing them.
  // eslint-disable-next-line sonarjs/arrow-function-convention
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!request.url().includes("amazonaws.com")) {
      await route.continue();
      return;
    }
    const key = extractObjectKey(request.url());

    if (request.method() === "GET") {
      const stored = objects.get(key);
      if (!stored) {
        await route.fulfill({
          status: 404,
          contentType: "application/xml",
          body: '<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code><Message>Not Found</Message></Error>',
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: stored,
      });
      return;
    }

    if (request.method() === "PUT") {
      const body = request.postData() ?? "";
      objects.set(key, body);
      await route.fulfill({ status: 200, body: "" });
      return;
    }

    if (request.method() === "DELETE") {
      objects.delete(key);
      await route.fulfill({ status: 200, body: "" });
      return;
    }

    await route.fulfill({ status: 200, body: "" });
  });

  return objects;
};

const fillS3Form = async (
  root: Page | Locator,
  config: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    prefix?: string;
  }
): Promise<void> => {
  await root.getByLabel("Bucket").fill(config.bucket);
  await root.getByLabel("Region").fill(config.region);
  await root
    .getByLabel("Prefix (optional)")
    .fill(config.prefix ?? "embervault/");
  await root.getByLabel("Access key ID").fill(config.accessKeyId);
  await root.getByLabel("Secret access key").fill(config.secretAccessKey);
};

const mockS3FailureNetwork = async (page: Page): Promise<void> => {
  // eslint-disable-next-line sonarjs/arrow-function-convention
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!request.url().includes("amazonaws.com")) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 403,
      contentType: "application/xml",
      body: '<?xml version="1.0" encoding="UTF-8"?><Error><Code>AccessDenied</Code><Message>Forbidden</Message></Error>',
    });
  });
};

test("onboarding can connect to s3 storage (network mocked)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", onboardingSkipMessage);
  const objects = await mockS3Network(page);

  await page.goto(onboardingPath);

  await fillS3Form(page, {
    bucket: "s3://bucket",
    region: "us-east-1",
    accessKeyId: mockAccessKeyId,
    secretAccessKey: mockSecretAccessKey,
  });

  await page.getByRole("button", { name: connectS3Label }).click();

  await expect(page).toHaveURL(appPathPattern);
  await expect(page.getByTestId("note-list-title")).toBeVisible();
  await expect(page.getByTestId("sync-status-badge")).toHaveText(
    singleLineSyncBadgePattern
  );

  expect(objects.has(vaultStorageKey)).toBe(true);
});

test("settings can migrate browser storage vault to s3", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", storageSkipMessage);

  const objects = await mockS3Network(page);

  await page.goto(onboardingPath);
  await page.getByTestId("use-browser-storage").click();
  await expect(page).toHaveURL(appPathPattern);

  await page.getByTestId("new-note").click();
  await expect(
    page.locator('[data-testid^="note-row-"]').first()
  ).toBeVisible();

  await page.getByTestId(openSettingsTestId).click();
  const settingsModal = page.getByTestId(settingsModalTestId);
  await expect(settingsModal).toBeVisible();

  await fillS3Form(settingsModal, {
    bucket: "s3://bucket-settings",
    region: "us-east-1",
    accessKeyId: mockAccessKeyId,
    secretAccessKey: mockSecretAccessKey,
  });
  await settingsModal.getByRole("button", { name: connectS3Label }).click();

  await expect(page.getByTestId("confirm-dialog")).toBeVisible();
  await expect(page.getByText("Switch to S3 storage")).toBeVisible();
  await page.getByTestId("confirm-submit").click();

  await expect(
    page.getByRole("status").filter({ hasText: "Migration complete." })
  ).toBeVisible();

  await page.getByTestId(openSettingsTestId).click();
  await expect(page.getByTestId(settingsModalTestId)).toContainText(
    "Current bucket: bucket-settings"
  );
  await expect(
    page
      .getByTestId(settingsModalTestId)
      .getByRole("button", { name: "Update credentials" })
  ).toBeVisible();

  expect(objects.has(vaultStorageKey)).toBe(true);
});

test("s3 settings persist after preference updates and reload", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", storageSkipMessage);

  await mockS3Network(page);

  await page.goto(onboardingPath);
  await fillS3Form(page, {
    bucket: "bucket-persist",
    region: "us-east-1",
    accessKeyId: mockAccessKeyId,
    secretAccessKey: mockSecretAccessKey,
  });
  await page.getByRole("button", { name: connectS3Label }).click();

  await expect(page).toHaveURL(appPathPattern);

  await page.getByTestId(openSettingsTestId).click();
  await expect(page.getByTestId(settingsModalTestId)).toBeVisible();
  await page.getByRole("button", { name: "General" }).click();
  const allNotesButton = page.getByRole("button", { name: "All notes" });
  await allNotesButton.click();
  await expect(allNotesButton).toHaveAttribute("data-active", "true");
  await page.getByRole("button", { name: "Close settings" }).click();

  await page.reload();
  await expect(page).toHaveURL(appPathPattern);
  await expect(page.getByTestId("note-list-title")).toBeVisible();

  await page.getByTestId(openSettingsTestId).click();
  const settingsModal = page.getByTestId(settingsModalTestId);
  await expect(settingsModal).toContainText("Current bucket: bucket-persist");
  await expect(
    settingsModal.getByRole("button", { name: "Update credentials" })
  ).toBeVisible();
});

test("settings keeps s3 draft values after failed migration", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", storageSkipMessage);

  await mockS3FailureNetwork(page);

  await page.goto(onboardingPath);
  await page.getByTestId("use-browser-storage").click();
  await expect(page).toHaveURL(appPathPattern);

  await page.getByTestId(openSettingsTestId).click();
  const settingsModal = page.getByTestId(settingsModalTestId);
  await expect(settingsModal).toBeVisible();

  await fillS3Form(settingsModal, {
    bucket: testDraftBucket,
    region: "eu-north-1",
    accessKeyId: mockAccessKeyId,
    secretAccessKey: mockSecretAccessKey,
  });
  await settingsModal.getByLabel(sessionTokenLabel).fill(testDraftSessionToken);

  await settingsModal.getByRole("button", { name: connectS3Label }).click();
  await expect(page.getByTestId("confirm-dialog")).toBeVisible();
  await page.getByTestId("confirm-submit").click();
  await expect(
    page.getByRole("status").filter({ hasText: "Migration failed:" })
  ).toBeVisible();

  await page.getByTestId(openSettingsTestId).click();
  const reopenedSettings = page.getByTestId(settingsModalTestId);
  await expect(reopenedSettings.getByLabel("Bucket")).toHaveValue(
    testDraftBucket
  );
  await expect(reopenedSettings.getByLabel("Region")).toHaveValue("eu-north-1");
  await expect(reopenedSettings.getByLabel("Access key ID")).toHaveValue(
    mockAccessKeyId
  );
  await expect(reopenedSettings.getByLabel("Secret access key")).toHaveValue(
    mockSecretAccessKey
  );
  await expect(reopenedSettings.getByLabel(sessionTokenLabel)).toHaveValue(
    testDraftSessionToken
  );

  await page.reload();
  await expect(page).toHaveURL(appPathPattern);
  await page.getByTestId(openSettingsTestId).click();
  const reloadedSettings = page.getByTestId(settingsModalTestId);
  await expect(reloadedSettings.getByLabel("Bucket")).toHaveValue(
    testDraftBucket
  );
  await expect(reloadedSettings.getByLabel(sessionTokenLabel)).toHaveValue(
    testDraftSessionToken
  );
});
