import { describe, expect, it } from "vitest";
import { buildGraph } from "$lib/core/graph/build";
import type { NoteIndexEntry } from "$lib/core/storage/types";

const createNote = (input: {
  id: string;
  title: string;
  linkOutgoing?: string[];
  deletedAt?: number | null;
}): NoteIndexEntry => ({
  id: input.id,
  title: input.title,
  folderId: null,
  tagIds: [],
  favorite: false,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: input.deletedAt ?? null,
  isTemplate: false,
  linkOutgoing: input.linkOutgoing ?? [],
});

describe("buildGraph", () => {
  it("adds edges for outgoing links that point to existing notes", () => {
    const noteA = createNote({
      id: "note-a",
      title: "Alpha",
      linkOutgoing: ["note-b"],
    });
    const noteB = createNote({
      id: "note-b",
      title: "Beta",
    });

    const graph = buildGraph([noteA, noteB]);

    expect(graph.hasEdge("note-a->note-b")).toBe(true);
  });

  it("skips edges for unresolved or missing targets", () => {
    const noteA = createNote({
      id: "note-a",
      title: "Alpha",
      linkOutgoing: ["missing-note"],
    });

    const graph = buildGraph([noteA]);

    expect(graph.size).toBe(0);
  });

  it("keeps id-based edges stable when titles change", () => {
    const noteA = createNote({
      id: "note-a",
      title: "Alpha",
      linkOutgoing: ["note-b"],
    });
    const noteB = createNote({
      id: "note-b",
      title: "Renamed",
    });

    const graph = buildGraph([noteA, noteB]);

    expect(graph.hasEdge("note-a->note-b")).toBe(true);
  });
});
