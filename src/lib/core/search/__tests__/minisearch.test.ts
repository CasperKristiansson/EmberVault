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

const createCustomNote = (input: {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}): NoteDocumentFile => ({
  id: input.id,
  title: input.title,
  createdAt: input.updatedAt - 10,
  updatedAt: input.updatedAt,
  folderId: null,
  tagIds: [],
  favorite: false,
  deletedAt: null,
  customFields: {},
  pmDoc: { type: "doc", content: [] },
  derived: {
    plainText: input.content,
    outgoingLinks: [],
  },
});

const now = (): number => Date.now();

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

  it("meets synthetic latency budgets for build and query", () => {
    const notes: NoteDocumentFile[] = [];
    for (let index = 0; index < 1000; index += 1) {
      notes.push(createNoteDocument(index));
    }

    const buildStart = now();
    const index = buildSearchIndex(notes);
    const buildDuration = now() - buildStart;

    const queries = ["common", "phrase", "note", "common phrase"];
    let queryTotal = 0;
    for (const query of queries) {
      const queryStart = now();
      querySearchIndex(index, { query, fuzzy: 0.3, prefix: true });
      queryTotal += now() - queryStart;
    }
    const averageQueryDuration = queryTotal / queries.length;

    expect(buildDuration).toBeLessThan(1000);
    expect(averageQueryDuration).toBeLessThan(100);
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

  it("matches fuzzy queries for note titles and content", () => {
    const noteA = createCustomNote({
      id: "note-a",
      title: "Project Plan",
      content: "Quarterly goals and deliverables.",
      updatedAt: 12,
    });
    const noteB = createCustomNote({
      id: "note-b",
      title: "Meeting Notes",
      content: "Sync agenda for the team.",
      updatedAt: 8,
    });

    const index = buildSearchIndex([noteA, noteB]);

    const results = querySearchIndex(index, {
      query: "proejct",
      fuzzy: 0.3,
      prefix: true,
    });

    expect(results.map(({ id }) => id)).toEqual(["note-a"]);
  });
});
