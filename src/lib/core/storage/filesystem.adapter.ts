import { IndexedDBAdapter } from "./indexeddb.adapter";
import { toNoteIndexEntry, toTemplateIndexEntry } from "./index-entries";
import { findAssetHandle, resolveAssetExtension } from "./filesystem/assets";
import {
  assetsDirectoryName,
  notesDirectoryName,
  templatesDirectoryName,
  trashDirectoryName,
  vaultFileName,
} from "./filesystem/constants";
import {
  isFileHandle,
  isNotFoundError,
  listDirectoryEntries,
  removeEntryIfExists,
} from "./filesystem/handles";
import {
  readJsonFile,
  readTextFile,
  writeBlobFile,
  writeJsonFile,
  writeTextFile,
} from "./filesystem/file-io";
import {
  noteFileName,
  noteMarkdownName,
  templateFileName,
  templateMarkdownName,
} from "./filesystem/paths";
import { createDefaultVault, defaultVaultId } from "./indexeddb/default-vault";
import type { VaultDirectories, VaultManifest } from "./filesystem/types";
import type {
  AssetMeta,
  NoteDocumentFile,
  NoteIndexEntry,
  StorageAdapter,
  TemplateIndexEntry,
  UIState,
  Vault,
} from "./types";

const supportsIndexedDatabase = (): boolean => "indexedDB" in globalThis;

export class FileSystemAdapter implements StorageAdapter {
  private readonly root: FileSystemDirectoryHandle;
  private readonly cacheAdapter: IndexedDBAdapter | null;
  private cacheReady = false;
  // eslint-disable-next-line compat/compat
  private manifestWriteQueue: Promise<void> = Promise.resolve();

  public constructor(rootHandle: FileSystemDirectoryHandle) {
    this.root = rootHandle;
    this.cacheAdapter = supportsIndexedDatabase()
      ? new IndexedDBAdapter()
      : null;
  }

  public async init(): Promise<void> {
    await this.ensureVaultManifest();
    await this.ensureVaultDirectories();
    if (this.cacheAdapter) {
      try {
        await this.cacheAdapter.init();
        this.cacheReady = true;
      } catch {
        this.cacheReady = false;
      }
    }
  }

  public async readVault(): Promise<Vault | null> {
    const manifest = await this.readVaultManifest();
    return manifest.vault ?? null;
  }

  public async writeVault(vault: Vault): Promise<void> {
    if (vault.id !== defaultVaultId) {
      throw new Error(
        `FileSystemAdapter.writeVault id mismatch for ${vault.id}.`
      );
    }
    await this.enqueueManifestWrite(async () => {
      const manifest = await this.readVaultManifest();
      await this.writeVaultManifest({
        ...manifest,
        vault,
      });
    });
  }

  public async listNotes(): Promise<NoteIndexEntry[]> {
    const vault = await this.readVault();
    if (!vault) {
      return [];
    }
    return Object.values(vault.notesIndex);
  }

  public async listTemplates(): Promise<TemplateIndexEntry[]> {
    const vault = await this.readVault();
    if (!vault) {
      return [];
    }
    return Object.values(vault.templatesIndex);
  }

  public async readNote(noteId: string): Promise<NoteDocumentFile | null> {
    try {
      const directories = await this.ensureVaultDirectories(false);
      const fileName = noteFileName(noteId);
      const storedNote = await readJsonFile<NoteDocumentFile>(
        directories.notes,
        fileName
      );
      if (storedNote) {
        return storedNote;
      }
      return await readJsonFile<NoteDocumentFile>(directories.trash, fileName);
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  public async readTemplate(
    templateId: string
  ): Promise<NoteDocumentFile | null> {
    try {
      const directories = await this.ensureVaultDirectories(false);
      return await readJsonFile<NoteDocumentFile>(
        directories.templates,
        templateFileName(templateId)
      );
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  public async writeNote(input: {
    noteId: string;
    noteDocument: NoteDocumentFile;
    derivedMarkdown: string;
  }): Promise<void> {
    if (input.noteDocument.id !== input.noteId) {
      throw new Error(
        `FileSystemAdapter.writeNote id mismatch ${input.noteId}.`
      );
    }
    const vault = await this.readVault();
    if (!vault) {
      throw new Error("FileSystemAdapter.writeNote missing vault.");
    }
    const directories = await this.ensureVaultDirectories();
    await writeJsonFile(
      directories.notes,
      noteFileName(input.noteId),
      input.noteDocument
    );
    await writeTextFile(
      directories.notes,
      noteMarkdownName(input.noteId),
      input.derivedMarkdown
    );

    const updatedVault: Vault = {
      ...vault,
      updatedAt: Math.max(vault.updatedAt, input.noteDocument.updatedAt),
      notesIndex: {
        ...vault.notesIndex,
        [input.noteId]: toNoteIndexEntry(input.noteDocument),
      },
    };

    await this.writeVault(updatedVault);
  }

  public async writeTemplate(input: {
    templateId: string;
    noteDocument: NoteDocumentFile;
    derivedMarkdown: string;
  }): Promise<void> {
    if (input.noteDocument.id !== input.templateId) {
      throw new Error(
        `FileSystemAdapter.writeTemplate id mismatch ${input.templateId}.`
      );
    }
    const vault = await this.readVault();
    if (!vault) {
      throw new Error("FileSystemAdapter.writeTemplate missing vault.");
    }

    const directories = await this.ensureVaultDirectories();
    await writeJsonFile(
      directories.templates,
      templateFileName(input.templateId),
      input.noteDocument
    );
    await writeTextFile(
      directories.templates,
      templateMarkdownName(input.templateId),
      input.derivedMarkdown
    );

    const updatedVault: Vault = {
      ...vault,
      updatedAt: Math.max(vault.updatedAt, input.noteDocument.updatedAt),
      templatesIndex: {
        ...vault.templatesIndex,
        [input.templateId]: toTemplateIndexEntry(input.noteDocument),
      },
    };

    await this.writeVault(updatedVault);
  }

  public async deleteNoteSoft(noteId: string): Promise<void> {
    const vault = await this.readVault();
    if (!vault) {
      throw new Error("FileSystemAdapter.deleteNoteSoft missing vault.");
    }
    const directories = await this.ensureVaultDirectories();
    const existing = await this.readNote(noteId);
    if (!existing) {
      throw new Error(
        `FileSystemAdapter.deleteNoteSoft missing note ${noteId}.`
      );
    }

    const timestamp = Date.now();
    const updatedNote: NoteDocumentFile = {
      ...existing,
      deletedAt: timestamp,
      updatedAt: timestamp,
    };
    const markdown =
      (await readTextFile(directories.notes, noteMarkdownName(noteId))) ?? "";

    await writeJsonFile(directories.trash, noteFileName(noteId), updatedNote);
    await writeTextFile(directories.trash, noteMarkdownName(noteId), markdown);

    await removeEntryIfExists(directories.notes, noteFileName(noteId));
    await removeEntryIfExists(directories.notes, noteMarkdownName(noteId));

    const updatedVault: Vault = {
      ...vault,
      updatedAt: Math.max(vault.updatedAt, timestamp),
      notesIndex: {
        ...vault.notesIndex,
        [noteId]: toNoteIndexEntry(updatedNote),
      },
    };

    await this.writeVault(updatedVault);
  }

  public async restoreNote(noteId: string): Promise<void> {
    const vault = await this.readVault();
    if (!vault) {
      throw new Error("FileSystemAdapter.restoreNote missing vault.");
    }
    const directories = await this.ensureVaultDirectories();
    const existing =
      (await readJsonFile<NoteDocumentFile>(
        directories.trash,
        noteFileName(noteId)
      )) ??
      (await readJsonFile<NoteDocumentFile>(
        directories.notes,
        noteFileName(noteId)
      ));
    if (!existing) {
      throw new Error(`FileSystemAdapter.restoreNote missing note ${noteId}.`);
    }
    const timestamp = Date.now();
    const currentFolderId = existing.folderId;
    const restoredFolderId =
      currentFolderId && Object.hasOwn(vault.folders, currentFolderId)
        ? currentFolderId
        : null;
    const updatedNote: NoteDocumentFile = {
      ...existing,
      deletedAt: null,
      folderId: restoredFolderId,
      updatedAt: timestamp,
    };
    const markdown =
      (await readTextFile(directories.trash, noteMarkdownName(noteId))) ??
      (await readTextFile(directories.notes, noteMarkdownName(noteId))) ??
      "";

    await writeJsonFile(directories.notes, noteFileName(noteId), updatedNote);
    await writeTextFile(directories.notes, noteMarkdownName(noteId), markdown);

    await removeEntryIfExists(directories.trash, noteFileName(noteId));
    await removeEntryIfExists(directories.trash, noteMarkdownName(noteId));

    const updatedVault: Vault = {
      ...vault,
      updatedAt: Math.max(vault.updatedAt, timestamp),
      notesIndex: {
        ...vault.notesIndex,
        [noteId]: toNoteIndexEntry(updatedNote),
      },
    };

    await this.writeVault(updatedVault);
  }

  public async deleteNotePermanent(noteId: string): Promise<void> {
    const vault = await this.readVault();
    if (!vault) {
      throw new Error("FileSystemAdapter.deleteNotePermanent missing vault.");
    }
    const directories = await this.ensureVaultDirectories();
    const remainingNotesIndex: Record<string, NoteIndexEntry> = {};
    for (const [entryId, entry] of Object.entries(vault.notesIndex)) {
      if (entryId !== noteId) {
        remainingNotesIndex[entryId] = entry;
      }
    }

    await removeEntryIfExists(directories.notes, noteFileName(noteId));
    await removeEntryIfExists(directories.notes, noteMarkdownName(noteId));
    await removeEntryIfExists(directories.trash, noteFileName(noteId));
    await removeEntryIfExists(directories.trash, noteMarkdownName(noteId));

    const updatedVault: Vault = {
      ...vault,
      updatedAt: Math.max(vault.updatedAt, Date.now()),
      notesIndex: remainingNotesIndex,
    };

    await this.writeVault(updatedVault);
  }

  public async deleteTemplate(templateId: string): Promise<void> {
    const vault = await this.readVault();
    if (!vault) {
      throw new Error("FileSystemAdapter.deleteTemplate missing vault.");
    }
    const directories = await this.ensureVaultDirectories();
    const remainingTemplatesIndex: Record<string, TemplateIndexEntry> = {};
    for (const [entryId, entry] of Object.entries(vault.templatesIndex)) {
      if (entryId !== templateId) {
        remainingTemplatesIndex[entryId] = entry;
      }
    }

    await removeEntryIfExists(
      directories.templates,
      templateFileName(templateId)
    );
    await removeEntryIfExists(
      directories.templates,
      templateMarkdownName(templateId)
    );

    const updatedVault: Vault = {
      ...vault,
      updatedAt: Math.max(vault.updatedAt, Date.now()),
      templatesIndex: remainingTemplatesIndex,
    };

    await this.writeVault(updatedVault);
  }

  public async writeAsset(input: {
    assetId: string;
    blob: Blob;
    meta?: AssetMeta;
  }): Promise<void> {
    const vault = await this.readVault();
    if (vault) {
      const directories = await this.ensureVaultDirectories();
      const extension = resolveAssetExtension(
        input.meta?.mime ?? input.blob.type
      );
      const fileName = `${input.assetId}.${extension}`;
      await writeBlobFile(directories.assets, fileName, input.blob);
      return;
    }
    throw new Error("FileSystemAdapter.writeAsset missing vault.");
  }

  public async readAsset(assetId: string): Promise<Blob | null> {
    const directories = await this.ensureVaultDirectories(false);
    const handle = await findAssetHandle(directories.assets, assetId);
    if (handle) {
      return handle.getFile();
    }
    return null;
  }

  public async listAssets(): Promise<string[]> {
    try {
      const directories = await this.ensureVaultDirectories(false);
      const entries = await listDirectoryEntries(directories.assets);
      const assetIds = new Set<string>();
      for (const entry of entries) {
        if (isFileHandle(entry)) {
          const { name } = entry;
          const dotIndex = name.indexOf(".");
          const assetId = dotIndex === -1 ? name : name.slice(0, dotIndex);
          assetIds.add(assetId);
        }
      }
      return [...assetIds];
    } catch (error) {
      if (isNotFoundError(error)) {
        return [];
      }
      throw error;
    }
  }

  public async deleteAsset(assetId: string): Promise<void> {
    const directories = await this.ensureVaultDirectories(false);
    const entries = await listDirectoryEntries(directories.assets);
    const removals: Promise<void>[] = [];
    for (const entry of entries) {
      if (isFileHandle(entry)) {
        const { name } = entry;
        if (name === assetId || name.startsWith(`${assetId}.`)) {
          removals.push(removeEntryIfExists(directories.assets, name));
        }
      }
    }
    await Promise.all(removals);
  }

  public async writeUIState(state: UIState): Promise<void> {
    if (this.cacheAdapter && this.cacheReady) {
      await this.cacheAdapter.writeUIState(state);
      return;
    }
    await this.enqueueManifestWrite(async () => {
      const manifest = await this.readVaultManifest();
      await this.writeVaultManifest({
        ...manifest,
        uiState: state,
      });
    });
  }

  public async readUIState(): Promise<UIState | null> {
    if (this.cacheAdapter && this.cacheReady) {
      const cached = await this.cacheAdapter.readUIState();
      if (cached) {
        return cached;
      }
    }
    const manifest = await this.readVaultManifest();
    const legacy = manifest.uiState ?? null;
    if (legacy && this.cacheAdapter && this.cacheReady) {
      await this.cacheAdapter.writeUIState(legacy);
    }
    return legacy;
  }

  public async writeSearchIndex(snapshot: string): Promise<void> {
    if (this.cacheAdapter && this.cacheReady) {
      await this.cacheAdapter.writeSearchIndex(snapshot);
      return;
    }
    await this.enqueueManifestWrite(async () => {
      const manifest = await this.readVaultManifest();
      await this.writeVaultManifest({
        ...manifest,
        searchIndex: snapshot,
      });
    });
  }

  public async readSearchIndex(): Promise<string | null> {
    if (this.cacheAdapter && this.cacheReady) {
      const cached = await this.cacheAdapter.readSearchIndex();
      if (cached) {
        return cached;
      }
    }
    const manifest = await this.readVaultManifest();
    const legacy = manifest.searchIndex ?? null;
    if (legacy && this.cacheAdapter && this.cacheReady) {
      await this.cacheAdapter.writeSearchIndex(legacy);
    }
    return legacy;
  }

  private async ensureVaultManifest(): Promise<void> {
    const manifest = await readJsonFile<VaultManifest>(
      this.root,
      vaultFileName
    );
    if (!manifest) {
      await this.writeVaultManifest({
        version: 1,
        vault: createDefaultVault(),
      });
      return;
    }
    if (!manifest.vault) {
      await this.writeVaultManifest({
        ...manifest,
        vault: createDefaultVault(),
      });
    }
  }

  private async readVaultManifest(): Promise<VaultManifest> {
    const manifest = await readJsonFile<VaultManifest>(
      this.root,
      vaultFileName
    );
    return manifest ?? { version: 1, vault: createDefaultVault() };
  }

  private async writeVaultManifest(manifest: VaultManifest): Promise<void> {
    await writeJsonFile(this.root, vaultFileName, manifest);
  }

  private async enqueueManifestWrite(
    operation: () => Promise<void>
  ): Promise<void> {
    const previousQueue = this.manifestWriteQueue;
    const next = (async () => {
      try {
        await previousQueue;
      } catch {
        // Keep the queue alive even if a prior write failed.
      }
      await operation();
    })();
    this.manifestWriteQueue = next;
    await next;
  }

  private async ensureVaultDirectories(
    create = true
  ): Promise<VaultDirectories> {
    const notes = await this.root.getDirectoryHandle(notesDirectoryName, {
      create,
    });
    const templates = await this.root.getDirectoryHandle(
      templatesDirectoryName,
      {
        create,
      }
    );
    const assets = await this.root.getDirectoryHandle(assetsDirectoryName, {
      create,
    });
    const trash = await this.root.getDirectoryHandle(trashDirectoryName, {
      create,
    });
    return { notes, templates, assets, trash };
  }
}
