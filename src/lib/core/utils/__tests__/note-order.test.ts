/* eslint-disable sonarjs/arrow-function-convention */
import { describe, expect, it } from "vitest";
import {
  orderNotesForFolder,
  reorderNoteIds,
  resolveFolderNoteOrder,
  setFolderNoteOrder,
} from "../note-order";
import type { FolderTree, NoteIndexEntry } from "$lib/core/storage/types";

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

describe("note ordering", () => {
  it("orders notes by folder order and appends missing", () => {
    const notes = [
      createNote("a", "folder"),
      createNote("b", "folder"),
      createNote("c", "folder"),
    ];
    const folders: FolderTree = {
      folder: {
        id: "folder",
        name: "Folder",
        parentId: null,
        childFolderIds: [],
        noteIds: ["b", "a"],
      },
    };

    const ordered = orderNotesForFolder(notes, "folder", folders);
    expect(ordered.map((note) => note.id)).toEqual(["b", "a", "c"]);
  });

  it("ignores ordered ids not in the folder", () => {
    const notes = [createNote("a", "folder")];
    const folders: FolderTree = {
      folder: {
        id: "folder",
        name: "Folder",
        parentId: null,
        childFolderIds: [],
        noteIds: ["missing", "a"],
      },
    };

    const ordered = orderNotesForFolder(notes, "folder", folders);
    expect(ordered.map((note) => note.id)).toEqual(["a"]);
  });

  it("returns active notes in order when no folder is selected", () => {
    const notes = [
      createNote("a", null),
      createNote("b", "folder"),
      createNote("c", null, 123),
    ];

    const ordered = orderNotesForFolder(notes, null, {});
    expect(ordered.map((note) => note.id)).toEqual(["a", "b"]);
  });

  it("reorders ids within a folder", () => {
    expect(reorderNoteIds(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
  });

  it("updates folder note order", () => {
    const folders: FolderTree = {
      folder: {
        id: "folder",
        name: "Folder",
        parentId: null,
        childFolderIds: [],
        noteIds: ["a"],
      },
    };

    const updated = setFolderNoteOrder(folders, "folder", ["b", "a"]);
    expect(updated.folder.noteIds).toEqual(["b", "a"]);
    expect(
      resolveFolderNoteOrder([createNote("a", "folder")], "folder", updated)
    ).toEqual(["a"]);
  });
});
