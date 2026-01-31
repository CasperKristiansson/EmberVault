import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { readable } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyDocument } from "$lib/core/editor/tiptap-config";
import {
  deleteIndexedDatabase,
  IndexedDBAdapter,
} from "$lib/core/storage/indexeddb.adapter";
// eslint-disable-next-line sonarjs/no-implicit-dependencies
import GraphViewMock from "$lib/components/graph/__mocks__/GraphView.svelte";
// eslint-disable-next-line sonarjs/no-implicit-dependencies
import TiptapEditorMock from "$lib/components/editor/__mocks__/TiptapEditor.svelte";
import Page from "../+page.svelte";
import type { NoteDocumentFile, Project } from "$lib/core/storage/types";

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

vi.mock("$app/stores", () => ({
  page: readable({
    params: { projectId: "project-1" },
  }),
}));

vi.mock("$lib/components/graph/GraphView.svelte", () => ({
  default: GraphViewMock,
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

const createProject = (id: string): Project => {
  const timestamp = Date.now();
  return {
    id,
    name: "Personal",
    createdAt: timestamp,
    updatedAt: timestamp,
    folders: {},
    tags: {},
    notesIndex: {},
    templatesIndex: {},
    settings: {},
  };
};

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

const seedProject = async (): Promise<{
  project: Project;
  notes: NoteDocumentFile[];
}> => {
  const adapter = new IndexedDBAdapter();
  await adapter.init();

  const project = createProject("project-1");
  await adapter.createProject(project);

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
    projectId: project.id,
    noteId: noteA.id,
    noteDocument: noteA,
    derivedMarkdown: `# ${noteA.title}`,
  });

  await adapter.writeNote({
    projectId: project.id,
    noteId: noteB.id,
    noteDocument: noteB,
    derivedMarkdown: `# ${noteB.title}`,
  });

  return { project, notes: [noteA, noteB] };
};

describe("graph interactions", () => {
  beforeEach(async () => {
    await deleteIndexedDatabase();
  });

  afterEach(async () => {
    cleanup();
    await deleteIndexedDatabase();
  });

  it("opens a note when a graph node is activated", async () => {
    const { notes } = await seedProject();

    const { findByTestId, getByTestId } = render(Page);

    await findByTestId(`note-row-${notes[0]?.id ?? ""}`);

    await fireEvent.click(getByTestId("sidebar-view-graph"));
    await fireEvent.click(await findByTestId("graph-node-trigger"));

    const titleInput = await findByTestId("note-title");
    if (!(titleInput instanceof HTMLInputElement)) {
      throw new TypeError("Expected note title input to be an input element.");
    }

    await waitFor(() => {
      expect(titleInput.value).toBe(notes[0]?.title ?? "");
    });
  });
});
