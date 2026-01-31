import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDefaultProject,
  deleteIndexedDatabase,
  IndexedDBAdapter,
} from "../indexeddb.adapter";
import {
  buildSearchIndex,
  serializeSearchIndex,
} from "../../search/minisearch";
import type { NoteDocumentFile } from "../types";

const createNoteDocument = (index: number): NoteDocumentFile => ({
  id: `note-${index}`,
  title: `Note ${index}`,
  createdAt: index,
  updatedAt: index,
  folderId: null,
  tagIds: [],
  favorite: false,
  deletedAt: null,
  customFields: {},
  pmDoc: { type: "doc", content: [] },
  derived: {
    plainText: `Persisted content ${index}`,
    outgoingLinks: [],
  },
});

describe("IndexedDBAdapter search index persistence", () => {
  beforeEach(async () => {
    await deleteIndexedDatabase();
  });

  afterEach(async () => {
    await deleteIndexedDatabase();
  });

  it("writes and reads search index snapshots", async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    const project = createDefaultProject();
    await adapter.createProject(project);

    const notes = [createNoteDocument(1), createNoteDocument(2)];
    const index = buildSearchIndex(notes);
    const snapshot = serializeSearchIndex(index);

    await adapter.writeSearchIndex(project.id, snapshot);

    const stored = await adapter.readSearchIndex(project.id);
    expect(stored).toEqual(snapshot);
  });
});
