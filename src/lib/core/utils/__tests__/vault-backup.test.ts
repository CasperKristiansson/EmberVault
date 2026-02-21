import { describe, expect, it } from "vitest";
import {
  createVaultBackup,
  mergeVaultBackups,
  parseVaultBackup,
  restoreVaultBackup,
  serializeVaultBackup,
} from "../vault-backup";
import type {
  NoteDocumentFile,
  NoteIndexEntry,
  StorageAdapter,
  Vault,
} from "$lib/core/storage/types";

const yieldOnce = async (): Promise<void> => {
  await new Response().text();
};

const createVault = (
  input: {
    notesIndex?: Record<string, NoteIndexEntry>;
    folders?: Vault["folders"];
  } = {}
): Vault => ({
  id: "vault",
  name: "Test vault",
  createdAt: 1,
  updatedAt: 1,
  folders: input.folders ?? {},
  tags: {},
  notesIndex: input.notesIndex ?? {},
  templatesIndex: {},
  settings: {},
});

const createNoteDocument = (
  input: Partial<NoteDocumentFile> & { id: string; title: string }
): NoteDocumentFile => ({
  id: input.id,
  title: input.title,
  createdAt: input.createdAt ?? 1,
  updatedAt: input.updatedAt ?? 1,
  folderId: input.folderId ?? null,
  tagIds: input.tagIds ?? [],
  favorite: input.favorite ?? false,
  deletedAt: input.deletedAt ?? null,
  customFields: input.customFields ?? {},
  pmDoc: input.pmDoc ?? { type: "doc", content: [] },
  derived: input.derived ?? { plainText: "", outgoingLinks: [] },
});

const createMemoryAdapter = (): {
  adapter: StorageAdapter;
  getVault: () => Vault | null;
  setVault: (vault: Vault) => void;
  notes: Map<string, NoteDocumentFile>;
  assets: Map<string, Blob>;
} => {
  let vault: Vault | null = null;
  const notes = new Map<string, NoteDocumentFile>();
  const assets = new Map<string, Blob>();
  let uiState: Record<string, unknown> | null = null;
  let searchIndex: string | null = null;

  const adapter: StorageAdapter = {
    async init() {
      await yieldOnce();
    },
    async readVault() {
      await yieldOnce();
      return vault;
    },
    async writeVault(nextVault) {
      await yieldOnce();
      vault = nextVault;
    },
    async listNotes() {
      await yieldOnce();
      return Object.values(vault?.notesIndex ?? {});
    },
    async listTemplates() {
      await yieldOnce();
      return [];
    },
    async readNote(noteId) {
      await yieldOnce();
      return notes.get(noteId) ?? null;
    },
    async readTemplate() {
      await yieldOnce();
      return null;
    },
    async writeNote(input) {
      await yieldOnce();
      notes.set(input.noteId, input.noteDocument);
      if (!vault) {
        throw new Error("Missing vault");
      }
      vault = {
        ...vault,
        notesIndex: {
          ...vault.notesIndex,
          [input.noteId]: {
            id: input.noteId,
            title: input.noteDocument.title,
            folderId: input.noteDocument.folderId,
            tagIds: input.noteDocument.tagIds,
            favorite: input.noteDocument.favorite,
            createdAt: input.noteDocument.createdAt,
            updatedAt: input.noteDocument.updatedAt,
            deletedAt: input.noteDocument.deletedAt,
            isTemplate: false,
          },
        },
      };
    },
    async writeTemplate() {
      await yieldOnce();
    },
    async deleteNoteSoft() {
      await yieldOnce();
    },
    async restoreNote() {
      await yieldOnce();
    },
    async deleteNotePermanent(noteId) {
      await yieldOnce();
      notes.delete(noteId);
      if (vault) {
        vault = {
          ...vault,
          notesIndex: Object.fromEntries(
            Object.entries(vault.notesIndex).filter(([id]) => id !== noteId)
          ),
        };
      }
    },
    async deleteTemplate() {
      await yieldOnce();
    },
    async writeAsset(input) {
      await yieldOnce();
      assets.set(input.assetId, input.blob);
    },
    async readAsset(assetId) {
      await yieldOnce();
      return assets.get(assetId) ?? null;
    },
    async listAssets() {
      await yieldOnce();
      return [...assets.keys()];
    },
    async deleteAsset(assetId) {
      await yieldOnce();
      assets.delete(assetId);
    },
    async writeUIState(state) {
      await yieldOnce();
      uiState = state;
    },
    async readUIState() {
      await yieldOnce();
      return uiState;
    },
    async writeSearchIndex(snapshot) {
      await yieldOnce();
      searchIndex = snapshot;
    },
    async readSearchIndex() {
      await yieldOnce();
      return searchIndex;
    },
    async getSyncStatus() {
      await yieldOnce();
      return {
        state: "idle",
        pendingCount: 0,
        lastSuccessAt: null,
        lastError: null,
        lastInitResolution: null,
      };
    },
    async flushPendingSync() {
      await yieldOnce();
    },
  };

  const getVault = (): Vault | null => vault;
  const setVault = function setVault(nextVault: Vault): void {
    vault = nextVault;
  };

  return {
    adapter,
    notes,
    assets,
    getVault,
    setVault,
  };
};

/* eslint-disable sonarjs/max-lines-per-function, sonarjs/no-duplicate-string */
describe("vault backup", () => {
  it("roundtrips serialize/parse", async () => {
    const memory = createMemoryAdapter();
    const note: NoteDocumentFile = {
      id: "note-1",
      title: "Alpha",
      createdAt: 1,
      updatedAt: 2,
      folderId: null,
      tagIds: [],
      favorite: false,
      deletedAt: null,
      customFields: {},
      pmDoc: { type: "doc", content: [] },
      derived: { plainText: "Body", outgoingLinks: [] },
    };

    memory.setVault(
      createVault({
        notesIndex: {
          "note-1": {
            id: "note-1",
            title: "Alpha",
            folderId: null,
            tagIds: [],
            favorite: false,
            createdAt: 1,
            updatedAt: 2,
            deletedAt: null,
            isTemplate: false,
          },
        },
      })
    );
    memory.notes.set("note-1", note);

    const vault = memory.getVault();
    expect(vault).not.toBeNull();

    if (!vault) {
      throw new Error("Missing test vault");
    }
    const backup = await createVaultBackup({ adapter: memory.adapter, vault });
    const { blob } = await serializeVaultBackup({ backup, compress: false });
    const parsed = await parseVaultBackup({ file: blob });

    expect(parsed.version).toBe(1);
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.notes[0]?.noteId).toBe("note-1");
  });

  it("restore wipes existing notes and assets", async () => {
    const memory = createMemoryAdapter();
    memory.setVault(
      createVault({
        notesIndex: {
          "note-a": {
            id: "note-a",
            title: "A",
            folderId: null,
            tagIds: [],
            favorite: false,
            createdAt: 1,
            updatedAt: 1,
            deletedAt: null,
            isTemplate: false,
          },
          "note-b": {
            id: "note-b",
            title: "B",
            folderId: null,
            tagIds: [],
            favorite: false,
            createdAt: 1,
            updatedAt: 1,
            deletedAt: null,
            isTemplate: false,
          },
        },
      })
    );

    memory.notes.set("note-a", {
      id: "note-a",
      title: "A",
      createdAt: 1,
      updatedAt: 1,
      folderId: null,
      tagIds: [],
      favorite: false,
      deletedAt: null,
      customFields: {},
      pmDoc: { type: "doc", content: [] },
      derived: { plainText: "", outgoingLinks: [] },
    });
    memory.notes.set("note-b", {
      id: "note-b",
      title: "B",
      createdAt: 1,
      updatedAt: 1,
      folderId: null,
      tagIds: [],
      favorite: false,
      deletedAt: null,
      customFields: {},
      pmDoc: { type: "doc", content: [] },
      derived: { plainText: "", outgoingLinks: [] },
    });
    memory.assets.set("asset-1", new Blob([new Uint8Array([1, 2, 3])]));

    const existingVault = memory.getVault();
    expect(existingVault).not.toBeNull();
    if (!existingVault) {
      throw new Error("Missing test vault");
    }
    const noteAEntry = existingVault.notesIndex["note-a"];
    const noteADocument = memory.notes.get("note-a");
    if (!noteADocument) {
      throw new Error("Missing note-a document");
    }

    const backup = await createVaultBackup({
      adapter: memory.adapter,
      vault: createVault({
        notesIndex: {
          "note-a": noteAEntry,
        },
      }),
    });
    backup.notes = [
      {
        noteId: "note-a",
        noteDocument: noteADocument,
        derivedMarkdown: "# A\n",
      },
    ];
    backup.assets = [];

    await restoreVaultBackup({ adapter: memory.adapter, backup });

    const restoredVault = memory.getVault();
    expect(Object.keys(restoredVault?.notesIndex ?? {})).toEqual(["note-a"]);
    expect(memory.notes.has("note-b")).toBe(false);
    expect(memory.assets.size).toBe(0);
  });

  it("merges backups and keeps incoming note content for title conflicts", () => {
    const baseFolderId = "remote-folder";
    const incomingFolderId = "phone-folder";
    const remoteNoteId = "remote-note";
    const incomingNoteId = "phone-note";

    const merged = mergeVaultBackups({
      base: {
        format: "embervault-backup",
        version: 1,
        createdAt: 10,
        vault: createVault({
          folders: {
            [baseFolderId]: {
              id: baseFolderId,
              name: "Project A",
              parentId: null,
              childFolderIds: [],
            },
          },
        }),
        notes: [
          {
            noteId: remoteNoteId,
            noteDocument: createNoteDocument({
              id: remoteNoteId,
              title: "Roadmap",
              folderId: baseFolderId,
              derived: { plainText: "remote content", outgoingLinks: [] },
            }),
            derivedMarkdown: "# Roadmap\n\nremote content",
          },
        ],
        assets: [
          { assetId: "asset-same", mime: "text/plain", dataBase64: "cmVtb3Rl" },
        ],
      },
      incoming: {
        format: "embervault-backup",
        version: 1,
        createdAt: 11,
        vault: createVault({
          folders: {
            [incomingFolderId]: {
              id: incomingFolderId,
              name: "Project A",
              parentId: null,
              childFolderIds: [],
            },
          },
        }),
        notes: [
          {
            noteId: incomingNoteId,
            noteDocument: createNoteDocument({
              id: incomingNoteId,
              title: "Roadmap",
              folderId: incomingFolderId,
              derived: { plainText: "incoming content", outgoingLinks: [] },
            }),
            derivedMarkdown: "# Roadmap\n\nincoming content",
          },
        ],
        assets: [
          {
            assetId: "asset-same",
            mime: "text/plain",
            dataBase64: "aW5jb21pbmc=",
          },
        ],
      },
    });

    expect(merged.notes).toHaveLength(1);
    expect(merged.notes[0]?.noteId).toBe(remoteNoteId);
    expect(merged.notes[0]?.noteDocument.id).toBe(remoteNoteId);
    expect(merged.notes[0]?.derivedMarkdown).toContain("incoming content");
    expect(merged.assets).toEqual([
      {
        assetId: "asset-same",
        mime: "text/plain",
        dataBase64: "aW5jb21pbmc=",
      },
    ]);
  });

  it("merges non-conflicting notes from both backups", () => {
    const merged = mergeVaultBackups({
      base: {
        format: "embervault-backup",
        version: 1,
        createdAt: 1,
        vault: createVault(),
        notes: [
          {
            noteId: "remote-note",
            noteDocument: createNoteDocument({
              id: "remote-note",
              title: "Remote",
            }),
            derivedMarkdown: "# Remote",
          },
        ],
        assets: [],
      },
      incoming: {
        format: "embervault-backup",
        version: 1,
        createdAt: 2,
        vault: createVault(),
        notes: [
          {
            noteId: "phone-note",
            noteDocument: createNoteDocument({
              id: "phone-note",
              title: "Phone",
            }),
            derivedMarkdown: "# Phone",
          },
        ],
        assets: [],
      },
    });

    const mergedIds = merged.notes
      // eslint-disable-next-line sonarjs/arrow-function-convention
      .map((entry) => entry.noteId)
      .toSorted((first, second) => first.localeCompare(second));
    expect(mergedIds).toEqual(["phone-note", "remote-note"]);
  });
});
/* eslint-enable sonarjs/max-lines-per-function, sonarjs/no-duplicate-string */
