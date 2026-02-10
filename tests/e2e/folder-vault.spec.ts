import { expect, test } from "@playwright/test";

const folderVaultInitScript = String.raw`
const createNotFoundError = (message) => {
  const error = new Error(message);
  error.name = "NotFoundError";
  return error;
};

const createNotAllowedError = (message) => {
  const error = new Error(message);
  error.name = "NotAllowedError";
  return error;
};

let permissionRevoked = false;

const throwIfRevoked = () => {
  if (permissionRevoked) {
    throw createNotAllowedError("Permission denied");
  }
};

const createAsyncIterator = (iterable) => {
  const iterator = iterable[Symbol.iterator]();
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next: async () => iterator.next(),
  };
};

const createFileHandle = (name) => {
  let data = "";
  let mimeType = "text/plain";
  return {
    kind: "file",
    name,
    getFile: async () => {
      throwIfRevoked();
      let blob;
      if (data instanceof Blob) {
        blob = data;
      } else if (data instanceof ArrayBuffer) {
        blob = new Blob([data]);
      } else if (data instanceof Uint8Array) {
        blob = new Blob([data.buffer]);
      } else {
        blob = new Blob([String(data)], { type: mimeType });
      }
      return new File([blob], name, { type: blob.type || mimeType });
    },
    createWritable: async () => ({
      write: async (input) => {
        throwIfRevoked();
        if (input instanceof Blob) {
          data = input;
          mimeType = input.type || "application/octet-stream";
          return;
        }
        if (input instanceof ArrayBuffer) {
          data = input;
          mimeType = "application/octet-stream";
          return;
        }
        if (input instanceof Uint8Array) {
          data = input;
          mimeType = "application/octet-stream";
          return;
        }
        data = String(input);
        mimeType = "text/plain";
      },
      close: async () => {
        throwIfRevoked();
        return undefined;
      },
    }),
  };
};

const createDirectoryHandle = (name) => {
  const entries = new Map();
  return {
    kind: "directory",
    name,
    getDirectoryHandle: async (childName, options = {}) => {
      throwIfRevoked();
      const existing = entries.get(childName);
      if (existing) {
        if (existing.kind !== "directory") {
          throw new Error("Entry is not a directory.");
        }
        return existing;
      }
      if (options.create) {
        const child = createDirectoryHandle(childName);
        entries.set(childName, child);
        return child;
      }
      throw createNotFoundError(
        "Directory " + childName + " not found."
      );
    },
    getFileHandle: async (childName, options = {}) => {
      throwIfRevoked();
      const existing = entries.get(childName);
      if (existing) {
        if (existing.kind !== "file") {
          throw new Error("Entry is not a file.");
        }
        return existing;
      }
      if (options.create) {
        const child = createFileHandle(childName);
        entries.set(childName, child);
        return child;
      }
      throw createNotFoundError("File " + childName + " not found.");
    },
    removeEntry: async (childName) => {
      throwIfRevoked();
      if (!entries.delete(childName)) {
        throw createNotFoundError("Entry " + childName + " not found.");
      }
    },
    values: () => {
      throwIfRevoked();
      return createAsyncIterator(entries.values());
    },
    _entries: entries,
  };
};

const root = createDirectoryHandle("root");
const listPaths = () => {
  const paths = [];
  const walk = (directory, prefix) => {
    for (const entry of directory._entries.values()) {
      const nextPath = prefix ? prefix + "/" + entry.name : entry.name;
      if (entry.kind === "file") {
        paths.push(nextPath);
      } else {
        walk(entry, nextPath);
      }
    }
  };
  walk(root, "");
  return paths;
};

globalThis.embervaultMockFs = {
  root,
  listPaths,
  revokePermissions: () => {
    permissionRevoked = true;
  },
  restorePermissions: () => {
    permissionRevoked = false;
  },
};
Object.defineProperty(globalThis, "showDirectoryPicker", {
  configurable: true,
  writable: true,
  value: async () => root,
});
`;

const hasPathMatch = (paths: string[], pattern: RegExp): boolean => {
  for (const path of paths) {
    if (pattern.test(path)) {
      return true;
    }
  }
  return false;
};

test.describe("folder vault", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  test("choose folder storage and create note writes files", async ({
    page,
  }) => {
    await page.addInitScript({ content: folderVaultInitScript });

    await page.goto("/onboarding");
    await page.getByTestId("use-folder-storage").click();
    await page.waitForURL(/\/app\/?$/);

    await page.getByTestId("new-note").click();
    await expect(page.locator('[data-save-state="saved"]')).toBeVisible();
    await expect(
      page.locator('[data-testid^="note-row-"]').first()
    ).toBeVisible();

    const paths = await page.evaluate(() => {
      const globalWithMock = globalThis as typeof globalThis & {
        embervaultMockFs?: { listPaths: () => string[] };
      };
      return globalWithMock.embervaultMockFs?.listPaths() ?? [];
    });

    expect(hasPathMatch(paths, /vault\.json$/)).toBe(true);
    expect(hasPathMatch(paths, /notes\/[^/]+\.json$/)).toBe(true);
    expect(hasPathMatch(paths, /notes\/[^/]+\.md$/)).toBe(true);
  });

  test("revoked permission can switch to browser storage", async ({ page }) => {
    await page.addInitScript({ content: folderVaultInitScript });

    await page.goto("/onboarding");
    await page.getByTestId("use-folder-storage").click();
    await page.waitForURL(/\/app\/?$/);

    await page.evaluate(() => {
      const globalWithMock = globalThis as typeof globalThis & {
        embervaultMockFs?: { revokePermissions?: () => void };
      };
      globalWithMock.embervaultMockFs?.revokePermissions?.();
    });

    const confirmDialog = page.getByTestId("confirm-dialog");
    // The recovery prompt may open immediately after permissions are revoked, or
    // after the next filesystem operation. Support both to avoid flakiness.
    if (!(await confirmDialog.isVisible())) {
      await page.getByTestId("new-note").click();
    }
    await expect(confirmDialog).toBeVisible();

    await page.getByTestId("confirm-cancel").click();
    await expect(page.getByTestId("toast")).toContainText(
      "Could not access folder, switched to browser storage."
    );
  });
});
