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

const yieldOnce = async (): Promise<void> => {
  await new Response().text();
};

const createVault = (notesIndex: Record<string, NoteIndexEntry>): Vault => ({
  id: "vault",
  name: "Test vault",
  createdAt: 1,
  updatedAt: 1,
  folders: {},
  tags: {},
  templatesIndex: {},
  settings: {},
  notesIndex,
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
    async writeNote() {
      await yieldOnce();
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
    async deleteNotePermanent() {
      await yieldOnce();
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
    async writeUIState() {
      await yieldOnce();
    },
    async readUIState() {
      await yieldOnce();
      return null;
    },
    async writeSearchIndex() {
      await yieldOnce();
    },
    async readSearchIndex() {
      await yieldOnce();
      return null;
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

    const report = await runVaultIntegrityCheck({
      adapter: memory.adapter,
      vault,
    });
    let sawMissingNote = false;
    let sawOrphanAsset = false;
    for (const issue of report.issues) {
      if (issue.noteId === "missing") {
        sawMissingNote = true;
      }
      if (issue.assetId === "orphan") {
        sawOrphanAsset = true;
      }
    }
    expect(sawMissingNote).toBe(true);
    expect(sawOrphanAsset).toBe(true);

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
