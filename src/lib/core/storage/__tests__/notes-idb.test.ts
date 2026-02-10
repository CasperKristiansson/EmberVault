import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDefaultVault,
  deleteIndexedDatabase,
  IndexedDBAdapter,
} from "../indexeddb.adapter";
import type { NoteDocumentFile } from "../types";

const defaultNoteTitle = "First note";
const defaultMarkdown = "# First note";
const updatedNoteTitle = "Updated note";
const updatedMarkdown = "# Updated note";
const missingFolderId = "missing-folder";

const createNoteDocument = (
  overrides: Partial<NoteDocumentFile> = {}
): NoteDocumentFile => ({
  id: "note-1",
  title: defaultNoteTitle,
  createdAt: 1,
  updatedAt: 1,
  folderId: null,
  tagIds: [],
  favorite: false,
  deletedAt: null,
  customFields: {},
  pmDoc: { type: "doc", content: [] },
  derived: {
    plainText: defaultNoteTitle,
    outgoingLinks: [],
  },
  ...overrides,
});

describe("IndexedDBAdapter note persistence", () => {
  beforeEach(async () => {
    await deleteIndexedDatabase();
  });

  afterEach(async () => {
    await deleteIndexedDatabase();
  });

  it("writes, reads, and lists notes", async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    const vault = createDefaultVault();
    await adapter.writeVault(vault);

    const note = createNoteDocument();
    await adapter.writeNote({
      noteId: note.id,
      noteDocument: note,
      derivedMarkdown: defaultMarkdown,
    });

    const stored = await adapter.readNote(note.id);
    expect(stored).toEqual(note);

    const listed = await adapter.listNotes();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      id: note.id,
      title: note.title,
      deletedAt: null,
      isTemplate: false,
    });

    const updatedNote = createNoteDocument({
      title: updatedNoteTitle,
      updatedAt: 2,
    });

    await adapter.writeNote({
      noteId: updatedNote.id,
      noteDocument: updatedNote,
      derivedMarkdown: updatedMarkdown,
    });

    const refreshed = await adapter.readNote(updatedNote.id);
    expect(refreshed?.title).toBe(updatedNoteTitle);

    const refreshedList = await adapter.listNotes();
    expect(refreshedList).toHaveLength(1);
    expect(refreshedList[0]?.title).toBe(updatedNoteTitle);
  });

  it("soft deletes, restores, and permanently deletes notes", async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    const vault = createDefaultVault();
    await adapter.writeVault(vault);

    const note = createNoteDocument({ folderId: missingFolderId });
    await adapter.writeNote({
      noteId: note.id,
      noteDocument: note,
      derivedMarkdown: defaultMarkdown,
    });

    await adapter.deleteNoteSoft(note.id);

    const trashed = await adapter.readNote(note.id);
    expect(trashed).not.toBeNull();
    expect(trashed?.deletedAt).not.toBeNull();

    const trashList = await adapter.listNotes();
    expect(trashList).toHaveLength(1);
    expect(trashList[0]?.deletedAt).not.toBeNull();

    await adapter.restoreNote(note.id);

    const restored = await adapter.readNote(note.id);
    expect(restored?.deletedAt).toBeNull();
    expect(restored?.folderId).toBeNull();

    const restoredList = await adapter.listNotes();
    expect(restoredList).toHaveLength(1);
    expect(restoredList[0]?.deletedAt).toBeNull();
    expect(restoredList[0]?.folderId).toBeNull();

    await adapter.deleteNotePermanent(note.id);

    const deleted = await adapter.readNote(note.id);
    expect(deleted).toBeNull();

    const remaining = await adapter.listNotes();
    expect(remaining).toHaveLength(0);
  });
});
