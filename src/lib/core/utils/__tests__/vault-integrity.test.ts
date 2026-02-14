import { describe, expect, it } from "vitest";
import {
  applyVaultIntegrityRepairs,
  runVaultIntegrityCheck,
} from "../vault-integrity";
import type {
  NoteDocumentFile,
  NoteIndexEntry,
  StorageAdapter,
  Vault,
} from "$lib/core/storage/types";

const createVault = (notesIndex: Record<string, NoteIndexEntry>): Vault => ({
  id: "vault",
  name: "Test vault",
  createdAt: 1,
  updatedAt: 1,
  folders: {},
  tags: {},
  notesIndex,
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
    writeNote: () => Promise.resolve(),
    writeTemplate: () => Promise.resolve(),
    deleteNoteSoft: () => Promise.resolve(),
    restoreNote: () => Promise.resolve(),
    deleteNotePermanent: () => Promise.resolve(),
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
    writeUIState: () => Promise.resolve(),
    readUIState: () => Promise.resolve(null),
    writeSearchIndex: () => Promise.resolve(),
    readSearchIndex: () => Promise.resolve(null),
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

describe("vault integrity", () => {
  it("detects missing notes and orphan assets and can repair", async () => {
    const memory = createMemoryAdapter();
    memory.setVault(
      createVault({
        missing: {
          id: "missing",
          title: "Missing",
          folderId: null,
          tagIds: [],
          favorite: false,
          createdAt: 1,
          updatedAt: 1,
          deletedAt: null,
          isTemplate: false,
        },
      })
    );
    memory.assets.set(
      "orphan",
      new Blob([new Uint8Array([1])], { type: "image/png" })
    );

    const vault = memory.getVault();
    expect(vault).not.toBeNull();
    if (!vault) {
      throw new Error("Missing test vault");
    }

    const report = await runVaultIntegrityCheck({ adapter: memory.adapter, vault });
    expect(report.issues.some(issue => issue.noteId === "missing")).toBe(true);
    expect(report.issues.some(issue => issue.assetId === "orphan")).toBe(true);

    const repaired = await applyVaultIntegrityRepairs({
      adapter: memory.adapter,
      vault,
      report,
    });

    expect(Object.keys(memory.getVault()?.notesIndex ?? {})).toEqual([]);
    expect(memory.assets.size).toBe(0);
    expect(repaired.checkedAt).toBeGreaterThan(0);
  });
});

