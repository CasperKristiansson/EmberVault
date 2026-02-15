import { test, expect } from "@playwright/test";

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
  return pathWithoutQuery.replace(/^\/+/u, "");
};

test("onboarding can connect to s3 storage (network mocked)", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName === "webkit",
    "Playwright WebKit does not reliably support the Web APIs needed for S3 onboarding in this test harness."
  );
  const objects = new Map<string, string>();

  // Route matching behaves differently across engines; use a catch-all route
  // and filter by URL to ensure WebKit is also intercepted.
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

    await route.fulfill({ status: 200, body: "" });
  });

  await page.goto("/onboarding");

  await page.getByLabel("Bucket").fill("bucket");
  await page.getByLabel("Region").fill("us-east-1");
  await page.getByLabel("Access key ID").fill("AKIA_TEST");
  await page.getByLabel("Secret access key").fill("SECRET_TEST");

  await page.getByRole("button", { name: "Connect S3" }).click();

  await page.waitForURL("**/app");
  await expect(page.getByTestId("note-list-title")).toBeVisible();

  expect(objects.has("embervault/vault.json")).toBe(true);
});
