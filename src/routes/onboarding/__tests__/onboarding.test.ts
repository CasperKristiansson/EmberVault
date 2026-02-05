import { cleanup, render, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi, afterEach } from "vitest";
import Page from "../+page.svelte";

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
}));

vi.mock("$app/paths", () => ({
  resolve: (path: string, parameters?: Record<string, string>) => {
    if (!parameters?.projectId) {
      return path;
    }
    return path.replace("[projectId]", parameters.projectId);
  },
}));

type WindowWithPicker = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
};

const windowWithPicker: WindowWithPicker = globalThis.window;

const supportMessage = "Your browser doesn't support folder storage.";

afterEach(() => {
  cleanup();
  if (windowWithPicker.showDirectoryPicker) {
    delete windowWithPicker.showDirectoryPicker;
  }
});

describe("onboarding vault selection", () => {
  it("shows info note when File System Access is unavailable", async () => {
    const { queryByTestId, getByText } = render(Page);

    await waitFor(() => {
      expect(getByText(supportMessage)).toBeTruthy();
    });

    expect(queryByTestId("use-folder-storage")).toBeNull();
  });

  it("shows folder option when File System Access is available", async () => {
    windowWithPicker.showDirectoryPicker = vi.fn();

    const { getByTestId, queryByText } = render(Page);

    await waitFor(() => {
      expect(getByTestId("use-folder-storage")).toBeTruthy();
    });

    expect(queryByText(supportMessage)).toBeNull();
  });
});
