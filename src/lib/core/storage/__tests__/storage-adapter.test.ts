import { describe, expectTypeOf, it } from "vitest";
import type {
  AssetMeta,
  NoteDocumentFile,
  NoteIndexEntry,
  Project,
  StorageAdapter,
  UIState,
} from "../types";

const projectId = "project-1";
const projectName = "Personal";
const noteId = "note-1";
const noteTitle = "First note";

const sampleProject: Project = {
  id: projectId,
  name: projectName,
  createdAt: 1,
  updatedAt: 1,
  folders: {},
  tags: {},
  notesIndex: {},
  templatesIndex: {},
  settings: {},
};

const noteIndex: NoteIndexEntry = {
  id: noteId,
  title: noteTitle,
  folderId: null,
  tagIds: [],
  favorite: false,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
  isTemplate: false,
};

const noteDocument: NoteDocumentFile = {
  id: noteId,
  title: noteTitle,
  createdAt: 1,
  updatedAt: 1,
  folderId: null,
  tagIds: [],
  favorite: false,
  deletedAt: null,
  customFields: {},
  pmDoc: { type: "doc", content: [] },
  derived: {
    plainText: noteTitle,
    outgoingLinks: [],
  },
};

const assetMeta: AssetMeta = {
  mime: "image/png",
  width: 64,
  height: 64,
  size: 128,
};

const uiState: UIState = {
  lastProjectId: projectId,
};

describe("StorageAdapter types", () => {
  it("accepts the expected shapes", () => {
    expectTypeOf(sampleProject).toExtend<Project>();
    expectTypeOf(noteIndex).toExtend<NoteIndexEntry>();
    expectTypeOf(noteDocument).toExtend<NoteDocumentFile>();
    expectTypeOf(assetMeta).toExtend<AssetMeta>();
    expectTypeOf(uiState).toExtend<UIState>();
    expectTypeOf<StorageAdapter>().toExtend<StorageAdapter>();
  });
});
