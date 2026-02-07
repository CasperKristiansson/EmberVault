import { cleanup, render } from "@testing-library/svelte";
import { writable } from "svelte/store";
import { afterEach, describe, expect, it, vi } from "vitest";
// eslint-disable-next-line sonarjs/no-implicit-dependencies
import TiptapEditorMock from "$lib/components/editor/__mocks__/TiptapEditor.svelte";
import Page from "../../+page.svelte";

vi.mock("$lib/state/adapter.store", () => {
  const adapterInstance = {
    init: vi.fn(async () => {
      // eslint-disable-next-line compat/compat
      await Promise.resolve();
      const error = new Error("Permission denied");
      error.name = "NotAllowedError";
      throw error;
    }),
  };
  const adapter = writable(adapterInstance);
  const storageMode = writable("filesystem");
  const initAdapter = () => adapterInstance;
  return {
    adapter,
    storageMode,
    initAdapter,
    switchAdapter: initAdapter,
  };
});

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
}));

vi.mock("$lib/components/editor/TiptapEditor.svelte", () => ({
  default: TiptapEditorMock,
}));

const ResizeObserverMock: typeof ResizeObserver = class ResizeObserverMock {
  public readonly observed = new Set<Element>();

  public observe(target?: Element): void {
    if (target) {
      this.observed.add(target);
    }
  }

  public unobserve(target?: Element): void {
    if (target) {
      this.observed.delete(target);
    }
  }

  public disconnect(): void {
    this.observed.clear();
  }
};

// eslint-disable-next-line compat/compat
globalThis.ResizeObserver = ResizeObserverMock;

afterEach(() => {
  cleanup();
});

describe("workspace permission recovery", () => {
  it("shows recovery dialog when folder access is denied", async () => {
    const { findByTestId, getByText } = render(Page);

    await findByTestId("confirm-dialog");

    expect(getByText("Folder access lost")).toBeTruthy();
    expect(getByText("Retry access")).toBeTruthy();
    expect(getByText("Switch to browser storage")).toBeTruthy();
  });
});
