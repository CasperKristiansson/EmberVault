/* eslint-disable sonarjs/arrow-function-convention */
import { toNoteIndexEntry, toTemplateIndexEntry } from "./index-entries";
import { toArrayBuffer, toBlob } from "./indexeddb/asset-conversion";
import { openIndexedDatabase } from "./indexeddb/database";
import { requestToPromise, waitForTransaction } from "./indexeddb/requests";
import {
  databaseName,
  searchIndexKey,
  storeNames,
  uiStateKey,
} from "./indexeddb/schema";
import { defaultVaultId } from "./indexeddb/default-vault";
import type { StoreName } from "./indexeddb/schema";
import type {
  AssetMeta,
  NoteDocumentFile,
  NoteIndexEntry,
  SyncStatus,
  StorageAdapter,
  TemplateIndexEntry,
  UIState,
  Vault,
} from "./types";

export {
  databaseName,
  databaseVersion,
  storeKeyPaths,
  storeNames,
  type StoreKeyPath,
} from "./indexeddb/schema";
export {
  deleteIndexedDatabase,
  openIndexedDatabase,
} from "./indexeddb/database";
export { createDefaultVault, defaultVaultId } from "./indexeddb/default-vault";

type IndexedDatabaseKey = IDBValidKey;

type NoteRecord = {
  noteId: string;
  noteDocument: NoteDocumentFile;
  derivedMarkdown: string;
};

type TemplateRecord = {
  templateId: string;
  noteDocument: NoteDocumentFile;
  derivedMarkdown: string;
};

type AssetRecord = {
  assetId: string;
  blob?: Blob;
  meta?: AssetMeta;
  bytes?: ArrayBuffer;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

type IndexedDatabaseAdapterOptions = {
  databaseName?: string;
};

export class IndexedDBAdapter implements StorageAdapter {
  private readonly adapterDatabaseName: string;

  public constructor(options: IndexedDatabaseAdapterOptions = {}) {
    this.adapterDatabaseName = options.databaseName ?? databaseName;
  }

  public async init(): Promise<void> {
    await this.openAndCloseDatabase();
  }

  public async readVault(): Promise<Vault | null> {
    const vault = await this.withStore<Vault | undefined>(
      storeNames.vault,
      "readonly",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      (store) => store.get(defaultVaultId)
    );
    return vault ?? null;
  }

  public async writeVault(vault: Vault): Promise<void> {
    if (vault.id !== defaultVaultId) {
      throw new Error(
        `IndexedDBAdapter.writeVault id mismatch for ${vault.id}.`
      );
    }
    await this.withStore<IndexedDatabaseKey>(
      storeNames.vault,
      "readwrite",
      (store) => store.put(vault)
    );
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
    const record = await this.readNoteRecord(noteId);
    return record?.noteDocument ?? null;
  }

  public async readTemplate(
    templateId: string
  ): Promise<NoteDocumentFile | null> {
    const record = await this.readTemplateRecord(templateId);
    return record?.noteDocument ?? null;
  }

  public async writeNote(input: {
    noteId: string;
    noteDocument: NoteDocumentFile;
    derivedMarkdown: string;
  }): Promise<void> {
    if (input.noteDocument.id !== input.noteId) {
      throw new Error(
        `IndexedDBAdapter.writeNote id mismatch for ${input.noteId}.`
      );
    }
    const vault = await this.readVault();
    if (!vault) {
      throw new Error("IndexedDBAdapter.writeNote missing vault.");
    }

    const record: NoteRecord = {
      noteId: input.noteId,
      noteDocument: input.noteDocument,
      derivedMarkdown: input.derivedMarkdown,
    };
    await this.writeNoteRecord(record);

    const noteIndexEntry = toNoteIndexEntry(input.noteDocument);
    const updatedVault: Vault = {
      ...vault,
      updatedAt: Math.max(vault.updatedAt, input.noteDocument.updatedAt),
      notesIndex: {
        ...vault.notesIndex,
        [input.noteId]: noteIndexEntry,
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
        `IndexedDBAdapter.writeTemplate id mismatch for ${input.templateId}.`
      );
    }
    const vault = await this.readVault();
    if (!vault) {
      throw new Error("IndexedDBAdapter.writeTemplate missing vault.");
    }

    const record: TemplateRecord = {
      templateId: input.templateId,
      noteDocument: input.noteDocument,
      derivedMarkdown: input.derivedMarkdown,
    };
    await this.writeTemplateRecord(record);

    const templateIndexEntry = toTemplateIndexEntry(input.noteDocument);
    const updatedVault: Vault = {
      ...vault,
      updatedAt: Math.max(vault.updatedAt, input.noteDocument.updatedAt),
      templatesIndex: {
        ...vault.templatesIndex,
        [input.templateId]: templateIndexEntry,
      },
    };

    await this.writeVault(updatedVault);
  }

  public async deleteNoteSoft(noteId: string): Promise<void> {
    const record = await this.readNoteRecord(noteId);
    if (!record) {
      throw new Error(
        `IndexedDBAdapter.deleteNoteSoft missing note ${noteId}.`
      );
    }
    const vault = await this.readVault();
    if (!vault) {
      throw new Error("IndexedDBAdapter.deleteNoteSoft missing vault.");
    }

    const timestamp = Date.now();
    const updatedNoteDocument: NoteDocumentFile = {
      ...record.noteDocument,
      deletedAt: timestamp,
      updatedAt: timestamp,
    };
    const updatedRecord: NoteRecord = {
      ...record,
      noteDocument: updatedNoteDocument,
    };
    await this.writeNoteRecord(updatedRecord);

    const updatedVault: Vault = {
      ...vault,
      updatedAt: Math.max(vault.updatedAt, timestamp),
      notesIndex: {
        ...vault.notesIndex,
        [noteId]: toNoteIndexEntry(updatedNoteDocument),
      },
    };

    await this.writeVault(updatedVault);
  }

  public async restoreNote(noteId: string): Promise<void> {
    const record = await this.readNoteRecord(noteId);
    if (!record) {
      throw new Error(`IndexedDBAdapter.restoreNote missing note ${noteId}.`);
    }
    const vault = await this.readVault();
    if (!vault) {
      throw new Error("IndexedDBAdapter.restoreNote missing vault.");
    }

    const timestamp = Date.now();
    const currentFolderId = record.noteDocument.folderId;
    const restoredFolderId =
      currentFolderId && Object.hasOwn(vault.folders, currentFolderId)
        ? currentFolderId
        : null;
    const updatedNoteDocument: NoteDocumentFile = {
      ...record.noteDocument,
      deletedAt: null,
      folderId: restoredFolderId,
      updatedAt: timestamp,
    };
    const updatedRecord: NoteRecord = {
      ...record,
      noteDocument: updatedNoteDocument,
    };
    await this.writeNoteRecord(updatedRecord);

    const updatedVault: Vault = {
      ...vault,
      updatedAt: Math.max(vault.updatedAt, timestamp),
      notesIndex: {
        ...vault.notesIndex,
        [noteId]: toNoteIndexEntry(updatedNoteDocument),
      },
    };

    await this.writeVault(updatedVault);
  }

  public async deleteNotePermanent(noteId: string): Promise<void> {
    const vault = await this.readVault();
    if (!vault) {
      throw new Error("IndexedDBAdapter.deleteNotePermanent missing vault.");
    }

    const remainingNotesIndex: Record<string, NoteIndexEntry> = {};
    for (const [entryId, entry] of Object.entries(vault.notesIndex)) {
      if (entryId !== noteId) {
        remainingNotesIndex[entryId] = entry;
      }
    }

    const updatedVault: Vault = {
      ...vault,
      updatedAt: Math.max(vault.updatedAt, Date.now()),
      notesIndex: remainingNotesIndex,
    };

    await this.writeVault(updatedVault);
    await this.deleteNoteRecord(noteId);
  }

  public async deleteTemplate(templateId: string): Promise<void> {
    const vault = await this.readVault();
    if (!vault) {
      throw new Error("IndexedDBAdapter.deleteTemplate missing vault.");
    }

    const remainingTemplatesIndex: Record<string, TemplateIndexEntry> = {};
    for (const [entryId, entry] of Object.entries(vault.templatesIndex)) {
      if (entryId !== templateId) {
        remainingTemplatesIndex[entryId] = entry;
      }
    }

    const updatedVault: Vault = {
      ...vault,
      updatedAt: Math.max(vault.updatedAt, Date.now()),
      templatesIndex: remainingTemplatesIndex,
    };

    await this.writeVault(updatedVault);
    await this.deleteTemplateRecord(templateId);
  }

  public async writeAsset(input: {
    assetId: string;
    blob: Blob;
    meta?: AssetMeta;
  }): Promise<void> {
    const bytes = await toArrayBuffer(input.blob);
    const record: AssetRecord = {
      assetId: input.assetId,
      meta: input.meta,
      bytes,
    };
    await this.withStore<IndexedDatabaseKey>(
      storeNames.assets,
      "readwrite",
      (store) => store.put(record)
    );
  }

  public async readAsset(assetId: string): Promise<Blob | null> {
    const record = await this.readAssetRecord(assetId);
    if (!record) {
      return null;
    }
    if (record.blob instanceof Blob) {
      return record.blob;
    }
    if (record.bytes) {
      return new Blob(
        [record.bytes],
        record.meta?.mime ? { type: record.meta.mime } : undefined
      );
    }
    return toBlob(record.blob, record.meta);
  }

  public async listAssets(): Promise<string[]> {
    const records = await this.withStore<AssetRecord[]>(
      storeNames.assets,
      "readonly",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      (store) => store.getAll()
    );
    return records.map((record) => record.assetId);
  }

  public async deleteAsset(assetId: string): Promise<void> {
    await this.withStore<undefined>(storeNames.assets, "readwrite", (store) =>
      store.delete(assetId)
    );
  }

  public async writeUIState(state: UIState): Promise<void> {
    await this.withStore<IndexedDatabaseKey>(
      storeNames.uiState,
      "readwrite",
      (store) => store.put(state, uiStateKey)
    );
  }

  public async readUIState(): Promise<UIState | null> {
    const state = await this.withStore<UIState | undefined>(
      storeNames.uiState,
      "readonly",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      (store) => store.get(uiStateKey)
    );
    return state ?? null;
  }

  public async writeSearchIndex(snapshot: string): Promise<void> {
    await this.withStore<IndexedDatabaseKey>(
      storeNames.searchIndex,
      "readwrite",
      (store) => {
        if (!store.keyPath) {
          return store.put(snapshot, searchIndexKey);
        }
        if (typeof store.keyPath === "string") {
          const payload: Record<string, unknown> = {
            [store.keyPath]: searchIndexKey,
            snapshot,
          };
          return store.put(payload);
        }
        const payload: Record<string, unknown> = { snapshot };
        for (const key of store.keyPath) {
          payload[key] = searchIndexKey;
        }
        return store.put(payload);
      }
    );
  }

  public async readSearchIndex(): Promise<string | null> {
    const snapshot = await this.withStore<unknown>(
      storeNames.searchIndex,
      "readonly",
      (store) => store.get(searchIndexKey)
    );
    if (typeof snapshot === "string") {
      return snapshot;
    }
    if (isRecord(snapshot)) {
      const candidate =
        snapshot.snapshot ?? snapshot.value ?? snapshot.index ?? snapshot.data;
      if (typeof candidate === "string") {
        return candidate;
      }
    }
    return null;
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this, @typescript-eslint/require-await
  public async getSyncStatus(): Promise<SyncStatus> {
    return {
      state: "idle",
      pendingCount: 0,
      lastSuccessAt: null,
      lastError: null,
      lastInitResolution: null,
    };
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this
  public async flushPendingSync(): Promise<void> {
    // IndexedDB mode does not maintain an async sync queue.
  }

  private async openAndCloseDatabase(): Promise<void> {
    const database = await openIndexedDatabase({
      databaseNameOverride: this.adapterDatabaseName,
    });
    if (database.name !== this.adapterDatabaseName) {
      database.close();
      throw new Error(
        `IndexedDBAdapter opened unexpected database ${database.name}.`
      );
    }
    database.close();
  }

  private async withStore<T>(
    storeName: StoreName,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    // eslint-disable-next-line sonarjs/prefer-immediate-return
    const result = await this.withDatabase(async (database) => {
      const transaction = database.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const actionResult = await requestToPromise(action(store));
      await waitForTransaction(transaction);
      return actionResult;
    });
    return result;
  }

  private async withDatabase<T>(
    action: (database: IDBDatabase) => T | Promise<T>
  ): Promise<T> {
    const database = await openIndexedDatabase({
      databaseNameOverride: this.adapterDatabaseName,
    });
    if (database.name !== this.adapterDatabaseName) {
      database.close();
      throw new Error(
        `IndexedDBAdapter opened unexpected database ${database.name}.`
      );
    }
    try {
      // eslint-disable-next-line sonarjs/prefer-immediate-return
      const result = await action(database);
      return result;
    } finally {
      database.close();
    }
  }

  private async readNoteRecord(noteId: string): Promise<NoteRecord | null> {
    const record = await this.withStore<NoteRecord | undefined>(
      storeNames.notes,
      "readonly",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      (store) => store.get(noteId)
    );
    return record ?? null;
  }

  private async readTemplateRecord(
    templateId: string
  ): Promise<TemplateRecord | null> {
    const record = await this.withStore<TemplateRecord | undefined>(
      storeNames.templates,
      "readonly",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      (store) => store.get(templateId)
    );
    return record ?? null;
  }

  private async writeNoteRecord(record: NoteRecord): Promise<void> {
    await this.withStore<IndexedDatabaseKey>(
      storeNames.notes,
      "readwrite",
      (store) => store.put(record)
    );
  }

  private async writeTemplateRecord(record: TemplateRecord): Promise<void> {
    await this.withStore<IndexedDatabaseKey>(
      storeNames.templates,
      "readwrite",
      (store) => store.put(record)
    );
  }

  private async deleteNoteRecord(noteId: string): Promise<void> {
    await this.withStore<undefined>(storeNames.notes, "readwrite", (store) =>
      store.delete(noteId)
    );
  }

  private async deleteTemplateRecord(templateId: string): Promise<void> {
    await this.withStore<undefined>(
      storeNames.templates,
      "readwrite",
      (store) => store.delete(templateId)
    );
  }

  private async readAssetRecord(assetId: string): Promise<AssetRecord | null> {
    const record = await this.withStore<AssetRecord | undefined>(
      storeNames.assets,
      "readonly",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      (store) => store.get(assetId)
    );
    return record ?? null;
  }
}
