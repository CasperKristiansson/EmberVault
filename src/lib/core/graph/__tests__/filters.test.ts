import { describe, expect, it } from "vitest";
import {
  filterNotesByTag,
  resolveNeighborhoodNoteIds,
} from "$lib/core/graph/filters";
import type { NoteIndexEntry } from "$lib/core/storage/types";

const createNote = (input: {
  id: string;
  title?: string;
  tagIds?: string[];
  linkOutgoing?: string[];
  deletedAt?: number | null;
}): NoteIndexEntry => ({
  id: input.id,
  title: input.title ?? input.id,
  folderId: null,
  tagIds: input.tagIds ?? [],
  favorite: false,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: input.deletedAt ?? null,
  isTemplate: false,
  linkOutgoing: input.linkOutgoing,
});

describe("filterNotesByTag", () => {
  it("filters notes by tag id", () => {
    const notes = [
      createNote({ id: "a", tagIds: ["tag-a"] }),
      createNote({ id: "b", tagIds: ["tag-b"] }),
      createNote({ id: "c", tagIds: ["tag-a", "tag-b"] }),
    ];

    const filteredIds: string[] = [];
    for (const note of filterNotesByTag(notes, "tag-a")) {
      filteredIds.push(note.id);
    }
    expect(filteredIds).toEqual(["a", "c"]);
  });
});

describe("resolveNeighborhoodNoteIds", () => {
  it("returns nodes within the requested depth", () => {
    const notes = [
      createNote({ id: "a", linkOutgoing: ["b"] }),
      createNote({ id: "b", linkOutgoing: ["c"] }),
      createNote({ id: "c" }),
      createNote({ id: "d" }),
    ];

    const depthOne = resolveNeighborhoodNoteIds(notes, "a", 1);
    expect(depthOne).toEqual(new Set(["a", "b"]));

    const depthTwo = resolveNeighborhoodNoteIds(notes, "a", 2);
    expect(depthTwo).toEqual(new Set(["a", "b", "c"]));
  });
});
