import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

const installDirectoryPickerCapture = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    /* eslint-disable no-unused-vars */
    type ExportCapture = {
      files: Record<string, string>;
    };

    const capture: ExportCapture = { files: {} };

    (
      globalThis as unknown as { embervaultExportCapture?: ExportCapture }
    ).embervaultExportCapture = capture;

    const notFoundError = Object.assign(new Error("Not found"), {
      name: "NotFoundError",
    });

    type Writable = {
      write(contents: unknown): Promise<void>;
      close(): void;
    };

    type FileHandle = {
      kind: "file";
      name: string;
      createWritable: () => Writable;
    };

    type DirectoryHandle = {
      kind: "directory";
      name: string;
      getDirectoryHandle: (
        name: string,
        options?: { create?: boolean }
      ) => DirectoryHandle;
      getFileHandle: (
        name: string,
        options?: { create?: boolean }
      ) => FileHandle;
      values: () => AsyncGenerator<FakeHandle>;
    };

    type FakeHandle = DirectoryHandle | FileHandle;

    const createWritable = (path: string): Writable => ({
      async write(contents: unknown) {
        if (typeof contents === "string") {
          capture.files[path] = contents;
          return;
        }
        if (contents instanceof Blob) {
          const buffer = await contents.arrayBuffer();
          capture.files[path] = `${contents.type}:${buffer.byteLength}`;
          return;
        }
        capture.files[path] = String(contents);
      },
      close() {
        if (!capture.files[path]) {
          capture.files[path] = "";
        }
      },
    });

    const createFileHandle = (path: string): FileHandle => ({
      kind: "file",
      name: path.split("/").pop() ?? path,
      createWritable: () => createWritable(path),
    });

    const createDirectoryHandle = (path: string): DirectoryHandle => {
      const directories: Record<string, DirectoryHandle> = {};
      const files: Record<string, FileHandle> = {};

      return {
        kind: "directory",
        name: path.split("/").pop() ?? "root",
        getDirectoryHandle(
          name: string,
          options?: { create?: boolean }
        ): DirectoryHandle {
          if (!directories[name]) {
            if (!options?.create) {
              throw notFoundError;
            }
            const nextPath = path ? `${path}/${name}` : name;
            directories[name] = createDirectoryHandle(nextPath);
          }
          return directories[name];
        },
        getFileHandle(
          name: string,
          options?: { create?: boolean }
        ): FileHandle {
          if (!files[name]) {
            if (!options?.create) {
              throw notFoundError;
            }
            const nextPath = path ? `${path}/${name}` : name;
            files[name] = createFileHandle(nextPath);
          }
          return files[name];
        },
        async *values(): AsyncGenerator<FakeHandle> {
          for (const entry of Object.values(directories)) {
            yield entry;
          }
          for (const entry of Object.values(files)) {
            yield entry;
          }
        },
      };
    };

    const root = createDirectoryHandle("");
    (
      globalThis as unknown as {
        showDirectoryPicker?: () => DirectoryHandle;
      }
    ).showDirectoryPicker = () => root;
    /* eslint-enable no-unused-vars */
  });
};

test("export vault writes markdown files into chosen folder", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding");
  await page.getByTestId("use-browser-storage").click();
  await page.waitForURL(/\/app\/?$/);

  await installDirectoryPickerCapture(page);

  await page.getByTestId("new-note").click();
  const bodyEditor = page.getByTestId("note-body");
  await bodyEditor.click();
  await page.keyboard.type("Export note");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Hello from export");

  await page.getByTestId("open-settings").click();
  await page.getByRole("button", { name: "Import/Export" }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();

  const files = await page.evaluate(() => {
    const capture = (
      globalThis as unknown as {
        embervaultExportCapture?: { files: Record<string, string> };
      }
    ).embervaultExportCapture;
    return capture?.files ?? {};
  });

  const noteFilePath = Object.keys(files).find(
    // eslint-disable-next-line sonarjs/arrow-function-convention
    (key) => key.startsWith("notes/") && key.endsWith(".md")
  );
  expect(noteFilePath).toBeTruthy();
  if (!noteFilePath) {
    return;
  }
  expect(files[noteFilePath]).toContain("# Export note");
  expect(files[noteFilePath]).toContain("Hello from export");
});
