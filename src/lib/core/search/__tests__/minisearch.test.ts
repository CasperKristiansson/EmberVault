import { describe, expect, it } from "vitest";
import {
  buildSearchIndex,
  loadSearchIndex,
  querySearchIndex,
  serializeSearchIndex,
  updateSearchIndex,
} from "../minisearch";
import type { NoteDocumentFile } from "../../storage/types";

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
    plainText: `Common phrase ${index}`,
    outgoingLinks: [],
  },
});

describe("MiniSearch index build", () => {
  it("indexes 1k notes and returns stable ordering", () => {
    const notes: NoteDocumentFile[] = [];
    for (let index = 0; index < 1000; index += 1) {
      notes.push(createNoteDocument(index));
    }
    const index = buildSearchIndex(notes);
    const results = querySearchIndex(index, { query: "common" });

    expect(results).toHaveLength(1000);
    expect(results[0]?.id).toBe("note-999");
    expect(results[1]?.id).toBe("note-998");
    expect(results[2]?.id).toBe("note-997");
  });

  it("serializes and hydrates search index", () => {
    const notes = [createNoteDocument(1), createNoteDocument(2)];
    const index = buildSearchIndex(notes);
    const snapshot = serializeSearchIndex(index);
    const restored = loadSearchIndex(snapshot);

    const results = querySearchIndex(restored, { query: "phrase" });
    expect(results).toHaveLength(2);
    expect(results.map(({ id }) => id)).toEqual(["note-2", "note-1"]);
  });

  it("updates results with incremental changes", () => {
    const noteA = createNoteDocument(1);
    const noteB = createNoteDocument(2);
    const index = buildSearchIndex([noteA, noteB]);

    const updatedNoteA: NoteDocumentFile = {
      ...noteA,
      updatedAt: 10,
      derived: {
        plainText: "Unique search phrase",
        outgoingLinks: [],
      },
    };

    updateSearchIndex(index, { type: "upsert", note: updatedNoteA });

    const updatedResults = querySearchIndex(index, { query: "unique" });
    expect(updatedResults.map(({ id }) => id)).toEqual(["note-1"]);

    const oldResults = querySearchIndex(index, { query: "common" });
    expect(oldResults.map(({ id }) => id)).toEqual(["note-2"]);

    updateSearchIndex(index, { type: "remove", noteId: "note-2" });
    const removedResults = querySearchIndex(index, { query: "common" });
    expect(removedResults).toHaveLength(0);
  });
});
