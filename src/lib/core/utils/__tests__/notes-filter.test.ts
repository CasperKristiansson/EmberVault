/* eslint-disable sonarjs/arrow-function-convention */
import { describe, expect, it } from "vitest";
import { filterNotesByFavorites, filterNotesByFolder } from "../notes-filter";
import type { NoteIndexEntry } from "$lib/core/storage/types";

const createNote = (
  id: string,
  folderId: string | null,
  deletedAt: number | null = null
): NoteIndexEntry => ({
  id,
  folderId,
  deletedAt,
  title: id,
  tagIds: [],
  favorite: false,
  createdAt: 0,
  updatedAt: 0,
  isTemplate: false,
});

describe("filterNotesByFolder", () => {
  it("returns all active notes when no folder is selected", () => {
    const notes = [
      createNote("a", null),
      createNote("b", "folder-1"),
      createNote("c", "folder-2", 123),
    ];

    const result = filterNotesByFolder(notes, null);
    expect(result.map((note) => note.id)).toEqual(["a", "b"]);
  });

  it("returns only notes that belong to the selected folder", () => {
    const notes = [
      createNote("a", "folder-1"),
      createNote("b", "folder-2"),
      createNote("c", "folder-1", 999),
    ];

    const result = filterNotesByFolder(notes, "folder-1");
    expect(result.map((note) => note.id)).toEqual(["a"]);
  });
});

describe("filterNotesByFavorites", () => {
  it("returns all notes when favoritesOnly is false", () => {
    const notes = [
      { ...createNote("a", null), favorite: false },
      { ...createNote("b", null), favorite: true },
    ];

    const result = filterNotesByFavorites(notes, false);
    expect(result.map((note) => note.id)).toEqual(["a", "b"]);
  });

  it("returns only favorite notes when favoritesOnly is true", () => {
    const notes = [
      { ...createNote("a", null), favorite: false },
      { ...createNote("b", null), favorite: true },
      { ...createNote("c", null), favorite: true },
    ];

    const result = filterNotesByFavorites(notes, true);
    expect(result.map((note) => note.id)).toEqual(["b", "c"]);
  });
});
