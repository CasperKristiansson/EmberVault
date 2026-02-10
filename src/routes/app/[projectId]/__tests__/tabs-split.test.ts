import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyDocument } from "$lib/core/editor/tiptap-config";
import { writeAppSettings } from "$lib/core/storage/app-settings";
import {
  createDefaultVault,
  deleteIndexedDatabase,
  IndexedDBAdapter,
} from "$lib/core/storage/indexeddb.adapter";
// eslint-disable-next-line sonarjs/no-implicit-dependencies
import TiptapEditorMock from "$lib/components/editor/__mocks__/TiptapEditor.svelte";
import Page from "../../+page.svelte";
import type { NoteDocumentFile, Vault } from "$lib/core/storage/types";

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

const createVault = (): Vault => createDefaultVault();

const createNoteDocument = (input: {
  id: string;
  title: string;
  updatedAt: number;
}): NoteDocumentFile => ({
  id: input.id,
  title: input.title,
  createdAt: input.updatedAt - 1000,
  updatedAt: input.updatedAt,
  folderId: null,
  tagIds: [],
  favorite: false,
  deletedAt: null,
  customFields: {},
  pmDoc: createEmptyDocument(),
  derived: {
    plainText: input.title,
    outgoingLinks: [],
  },
});

const seedVault = async (): Promise<{
  vault: Vault;
  notes: NoteDocumentFile[];
}> => {
  const adapter = new IndexedDBAdapter();
  await adapter.init();

  const vault = createVault();
  await adapter.writeVault(vault);

  const noteA = createNoteDocument({
    id: "note-a",
    title: "Alpha",
    updatedAt: 2000,
  });
  const noteB = createNoteDocument({
    id: "note-b",
    title: "Beta",
    updatedAt: 1000,
  });

  await adapter.writeNote({
    noteId: noteA.id,
    noteDocument: noteA,
    derivedMarkdown: `# ${noteA.title}`,
  });

  await adapter.writeNote({
    noteId: noteB.id,
    noteDocument: noteB,
    derivedMarkdown: `# ${noteB.title}`,
  });

  await writeAppSettings({ storageMode: "idb" });

  return { vault, notes: [noteA, noteB] };
};

describe("workspace tabs + panes", () => {
  beforeEach(async () => {
    await deleteIndexedDatabase();
  });

  afterEach(async () => {
    cleanup();
    await deleteIndexedDatabase();
  });

  it("closes the active tab and keeps the remaining tab active", async () => {
    const { notes } = await seedVault();

    const { container, findByTestId } = render(Page);

    await findByTestId(`note-row-${notes[0]?.id ?? ""}`);
    await findByTestId(`note-row-${notes[1]?.id ?? ""}`);

    const secondRow = container.querySelector(
      `[data-testid="note-row-${notes[1]?.id ?? ""}"]`
    );
    if (!(secondRow instanceof HTMLElement)) {
      throw new TypeError("Expected note row element");
    }

    await fireEvent.click(secondRow);

    await waitFor(() => {
      const tabs = container.querySelectorAll('[data-testid="tab-item"]');
      expect(tabs.length).toBe(2);
    });

    const closeButton = container.querySelector(
      `[data-testid="tab-close"][data-note-id="${notes[1]?.id ?? ""}"]`
    );
    if (!(closeButton instanceof HTMLButtonElement)) {
      throw new TypeError("Expected tab close button");
    }

    await fireEvent.click(closeButton);

    await waitFor(() => {
      const closedTab = container.querySelector(
        `[data-testid="tab-item"][data-note-id="${notes[1]?.id ?? ""}"]`
      );
      expect(closedTab).toBeNull();
    });

    const remainingTab = container.querySelector(
      `[data-testid="tab-item"][data-note-id="${notes[0]?.id ?? ""}"]`
    );
    if (!(remainingTab instanceof HTMLElement)) {
      throw new TypeError("Expected remaining tab element");
    }
    expect(remainingTab.getAttribute("data-active")).toBe("true");
  });

  it("does not show a split view toggle button", async () => {
    await seedVault();

    const { container, findByTestId, queryByTestId } = render(Page);

    await findByTestId("tab-list");

    expect(queryByTestId("toggle-split")).toBeNull();

    await waitFor(() => {
      const panes = container.querySelectorAll(
        '[data-testid="editor-pane-leaf"]'
      );
      expect(panes.length).toBe(1);
    });
  });
});
