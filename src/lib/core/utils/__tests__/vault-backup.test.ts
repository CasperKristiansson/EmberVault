import { describe, expect, it } from "vitest";
import {
  createVaultBackup,
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

const createVault = (input: { notesIndex?: Record<string, NoteIndexEntry> } = {}): Vault => ({
  id: "vault",
  name: "Test vault",
  createdAt: 1,
  updatedAt: 1,
  folders: {},
  tags: {},
  notesIndex: input.notesIndex ?? {},
  templatesIndex: {},
  settings: {},
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
    init: () => Promise.resolve(),
    readVault: () => Promise.resolve(vault),
    writeVault: (nextVault) => {
      vault = nextVault;
      return Promise.resolve();
    },
    listNotes: () => Promise.resolve(Object.values(vault?.notesIndex ?? {})),
    listTemplates: () => Promise.resolve([]),
    readNote: (noteId) => Promise.resolve(notes.get(noteId) ?? null),
    readTemplate: () => Promise.resolve(null),
    writeNote: (input) => {
      notes.set(input.noteId, input.noteDocument);
      if (!vault) {
        return Promise.reject(new Error("Missing vault"));
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
      return Promise.resolve();
    },
    writeTemplate: () => Promise.resolve(),
    deleteNoteSoft: () => Promise.resolve(),
    restoreNote: () => Promise.resolve(),
    deleteNotePermanent: (noteId) => {
      notes.delete(noteId);
      if (vault) {
        vault = {
          ...vault,
          notesIndex: Object.fromEntries(
            Object.entries(vault.notesIndex).filter(([id]) => id !== noteId)
          ),
        };
      }
      return Promise.resolve();
    },
    deleteTemplate: () => Promise.resolve(),
    writeAsset: (input) => {
      assets.set(input.assetId, input.blob);
      return Promise.resolve();
    },
    readAsset: (assetId) => Promise.resolve(assets.get(assetId) ?? null),
    listAssets: () => Promise.resolve([...assets.keys()]),
    deleteAsset: (assetId) => {
      assets.delete(assetId);
      return Promise.resolve();
    },
    writeUIState: (state) => {
      uiState = state;
      return Promise.resolve();
    },
    readUIState: () => Promise.resolve(uiState),
    writeSearchIndex: (snapshot) => {
      searchIndex = snapshot;
      return Promise.resolve();
    },
    readSearchIndex: () => Promise.resolve(searchIndex),
  };

  return {
    adapter,
    getVault: () => vault,
    setVault: (nextVault) => {
      vault = nextVault;
    },
    notes,
    assets,
  };
};

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
    if (!noteAEntry) {
      throw new Error("Missing note-a index entry");
    }
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
});
