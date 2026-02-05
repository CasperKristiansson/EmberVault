/* eslint-disable sonarjs/arrow-function-convention */
import { toNoteIndexEntry, toTemplateIndexEntry } from "./index-entries";
import { toArrayBuffer, toBlob } from "./indexeddb/asset-conversion";
import { openIndexedDatabase } from "./indexeddb/database";
import { requestToPromise, waitForTransaction } from "./indexeddb/requests";
import { databaseName, storeNames, uiStateKey } from "./indexeddb/schema";
import type { StoreName } from "./indexeddb/schema";
import type {
  AssetMeta,
  NoteDocumentFile,
  NoteIndexEntry,
  Project,
  StorageAdapter,
  TemplateIndexEntry,
  UIState,
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
export { createDefaultProject } from "./indexeddb/default-project";

type IndexedDatabaseKey = IDBValidKey;

type NoteRecord = {
  projectId: string;
  noteId: string;
  noteDocument: NoteDocumentFile;
  derivedMarkdown: string;
};

type TemplateRecord = {
  projectId: string;
  templateId: string;
  noteDocument: NoteDocumentFile;
  derivedMarkdown: string;
};

type AssetRecord = {
  projectId: string;
  assetId: string;
  blob?: Blob;
  meta?: AssetMeta;
  bytes?: ArrayBuffer;
};

type SearchIndexRecord = {
  projectId: string;
  snapshot: string;
};

export class IndexedDBAdapter implements StorageAdapter {
  private readonly adapterDatabaseName = databaseName;

  public async init(): Promise<void> {
    await this.openAndCloseDatabase();
  }

  public async listProjects(): Promise<Project[]> {
    // eslint-disable-next-line sonarjs/prefer-immediate-return
    const projects = await this.withStore<Project[]>(
      storeNames.projects,
      "readonly",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      (store) => store.getAll()
    );
    return projects;
  }

  public async createProject(project: Project): Promise<void> {
    await this.withStore<IndexedDatabaseKey>(
      storeNames.projects,
      "readwrite",
      (store) => store.add(project)
    );
  }

  public async readProject(projectId: string): Promise<Project | null> {
    const project = await this.withStore<Project | undefined>(
      storeNames.projects,
      "readonly",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      (store) => store.get(projectId)
    );
    return project ?? null;
  }

  public async writeProject(
    projectId: string,
    projectMeta: Project
  ): Promise<void> {
    if (projectMeta.id !== projectId) {
      throw new Error(
        `IndexedDBAdapter.writeProject id mismatch for ${projectId}.`
      );
    }
    await this.withStore<IndexedDatabaseKey>(
      storeNames.projects,
      "readwrite",
      (store) => store.put(projectMeta)
    );
  }

  public async listNotes(projectId: string): Promise<NoteIndexEntry[]> {
    const project = await this.readProject(projectId);
    if (!project) {
      return [];
    }
    return Object.values(project.notesIndex);
  }

  public async listTemplates(projectId: string): Promise<TemplateIndexEntry[]> {
    const project = await this.readProject(projectId);
    if (!project) {
      return [];
    }
    return Object.values(project.templatesIndex);
  }

  public async readNote(
    projectId: string,
    noteId: string
  ): Promise<NoteDocumentFile | null> {
    const record = await this.readNoteRecord(projectId, noteId);
    return record?.noteDocument ?? null;
  }

  public async readTemplate(
    projectId: string,
    templateId: string
  ): Promise<NoteDocumentFile | null> {
    const record = await this.readTemplateRecord(projectId, templateId);
    return record?.noteDocument ?? null;
  }

  public async writeNote(input: {
    projectId: string;
    noteId: string;
    noteDocument: NoteDocumentFile;
    derivedMarkdown: string;
  }): Promise<void> {
    if (input.noteDocument.id !== input.noteId) {
      throw new Error(
        `IndexedDBAdapter.writeNote id mismatch for ${input.projectId}:${input.noteId}.`
      );
    }
    const project = await this.readProject(input.projectId);
    if (!project) {
      throw new Error(
        `IndexedDBAdapter.writeNote missing project ${input.projectId}.`
      );
    }

    const record: NoteRecord = {
      projectId: input.projectId,
      noteId: input.noteId,
      noteDocument: input.noteDocument,
      derivedMarkdown: input.derivedMarkdown,
    };
    await this.writeNoteRecord(record);

    const noteIndexEntry = toNoteIndexEntry(input.noteDocument);
    const updatedProject: Project = {
      ...project,
      updatedAt: Math.max(project.updatedAt, input.noteDocument.updatedAt),
      notesIndex: {
        ...project.notesIndex,
        [input.noteId]: noteIndexEntry,
      },
    };

    await this.writeProject(input.projectId, updatedProject);
  }

  public async writeTemplate(input: {
    projectId: string;
    templateId: string;
    noteDocument: NoteDocumentFile;
    derivedMarkdown: string;
  }): Promise<void> {
    if (input.noteDocument.id !== input.templateId) {
      throw new Error(
        `IndexedDBAdapter.writeTemplate id mismatch for ${input.projectId}:${input.templateId}.`
      );
    }
    const project = await this.readProject(input.projectId);
    if (!project) {
      throw new Error(
        `IndexedDBAdapter.writeTemplate missing project ${input.projectId}.`
      );
    }

    const record: TemplateRecord = {
      projectId: input.projectId,
      templateId: input.templateId,
      noteDocument: input.noteDocument,
      derivedMarkdown: input.derivedMarkdown,
    };
    await this.writeTemplateRecord(record);

    const templateIndexEntry = toTemplateIndexEntry(input.noteDocument);
    const updatedProject: Project = {
      ...project,
      updatedAt: Math.max(project.updatedAt, input.noteDocument.updatedAt),
      templatesIndex: {
        ...project.templatesIndex,
        [input.templateId]: templateIndexEntry,
      },
    };

    await this.writeProject(input.projectId, updatedProject);
  }

  public async deleteNoteSoft(
    projectId: string,
    noteId: string
  ): Promise<void> {
    const record = await this.readNoteRecord(projectId, noteId);
    if (!record) {
      throw new Error(
        `IndexedDBAdapter.deleteNoteSoft missing note ${projectId}:${noteId}.`
      );
    }
    const project = await this.readProject(projectId);
    if (!project) {
      throw new Error(
        `IndexedDBAdapter.deleteNoteSoft missing project ${projectId}.`
      );
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

    const updatedProject: Project = {
      ...project,
      updatedAt: Math.max(project.updatedAt, timestamp),
      notesIndex: {
        ...project.notesIndex,
        [noteId]: toNoteIndexEntry(updatedNoteDocument),
      },
    };

    await this.writeProject(projectId, updatedProject);
  }

  public async restoreNote(projectId: string, noteId: string): Promise<void> {
    const record = await this.readNoteRecord(projectId, noteId);
    if (!record) {
      throw new Error(
        `IndexedDBAdapter.restoreNote missing note ${projectId}:${noteId}.`
      );
    }
    const project = await this.readProject(projectId);
    if (!project) {
      throw new Error(
        `IndexedDBAdapter.restoreNote missing project ${projectId}.`
      );
    }

    const timestamp = Date.now();
    const currentFolderId = record.noteDocument.folderId;
    const restoredFolderId =
      currentFolderId && Object.hasOwn(project.folders, currentFolderId)
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

    const updatedProject: Project = {
      ...project,
      updatedAt: Math.max(project.updatedAt, timestamp),
      notesIndex: {
        ...project.notesIndex,
        [noteId]: toNoteIndexEntry(updatedNoteDocument),
      },
    };

    await this.writeProject(projectId, updatedProject);
  }

  public async deleteNotePermanent(
    projectId: string,
    noteId: string
  ): Promise<void> {
    const project = await this.readProject(projectId);
    if (!project) {
      throw new Error(
        `IndexedDBAdapter.deleteNotePermanent missing project ${projectId}.`
      );
    }

    const remainingNotesIndex: Record<string, NoteIndexEntry> = {};
    for (const [entryId, entry] of Object.entries(project.notesIndex)) {
      if (entryId !== noteId) {
        remainingNotesIndex[entryId] = entry;
      }
    }

    const updatedProject: Project = {
      ...project,
      updatedAt: Math.max(project.updatedAt, Date.now()),
      notesIndex: remainingNotesIndex,
    };

    await this.writeProject(projectId, updatedProject);
    await this.deleteNoteRecord(projectId, noteId);
  }

  public async deleteTemplate(
    projectId: string,
    templateId: string
  ): Promise<void> {
    const project = await this.readProject(projectId);
    if (!project) {
      throw new Error(
        `IndexedDBAdapter.deleteTemplate missing project ${projectId}.`
      );
    }

    const remainingTemplatesIndex: Record<string, TemplateIndexEntry> = {};
    for (const [entryId, entry] of Object.entries(project.templatesIndex)) {
      if (entryId !== templateId) {
        remainingTemplatesIndex[entryId] = entry;
      }
    }

    const updatedProject: Project = {
      ...project,
      updatedAt: Math.max(project.updatedAt, Date.now()),
      templatesIndex: remainingTemplatesIndex,
    };

    await this.writeProject(projectId, updatedProject);
    await this.deleteTemplateRecord(projectId, templateId);
  }

  public async writeAsset(input: {
    projectId: string;
    assetId: string;
    blob: Blob;
    meta?: AssetMeta;
  }): Promise<void> {
    const bytes = await toArrayBuffer(input.blob);
    const record: AssetRecord = {
      projectId: input.projectId,
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

  public async readAsset(
    projectId: string,
    assetId: string
  ): Promise<Blob | null> {
    const record = await this.readAssetRecord(projectId, assetId);
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

  public async listAssets(projectId: string): Promise<string[]> {
    const range = IDBKeyRange.bound([projectId, ""], [projectId, "\uFFFF"]);
    const records = await this.withStore<AssetRecord[]>(
      storeNames.assets,
      "readonly",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      (store) => store.getAll(range)
    );
    return records.map((record) => record.assetId);
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

  public async writeSearchIndex(
    projectId: string,
    snapshot: string
  ): Promise<void> {
    const record: SearchIndexRecord = {
      projectId,
      snapshot,
    };
    await this.withStore<IndexedDatabaseKey>(
      storeNames.searchIndex,
      "readwrite",
      (store) => store.put(record)
    );
  }

  public async readSearchIndex(projectId: string): Promise<string | null> {
    const record = await this.withStore<SearchIndexRecord | undefined>(
      storeNames.searchIndex,
      "readonly",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      (store) => store.get(projectId)
    );
    return record?.snapshot ?? null;
  }

  private async openAndCloseDatabase(): Promise<void> {
    const database = await openIndexedDatabase();
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
    const database = await openIndexedDatabase();
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

  private async readNoteRecord(
    projectId: string,
    noteId: string
  ): Promise<NoteRecord | null> {
    const record = await this.withStore<NoteRecord | undefined>(
      storeNames.notes,
      "readonly",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      (store) => store.get([projectId, noteId])
    );
    return record ?? null;
  }

  private async readTemplateRecord(
    projectId: string,
    templateId: string
  ): Promise<TemplateRecord | null> {
    const record = await this.withStore<TemplateRecord | undefined>(
      storeNames.templates,
      "readonly",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      (store) => store.get([projectId, templateId])
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

  private async deleteNoteRecord(
    projectId: string,
    noteId: string
  ): Promise<void> {
    await this.withStore<undefined>(storeNames.notes, "readwrite", (store) =>
      store.delete([projectId, noteId])
    );
  }

  private async deleteTemplateRecord(
    projectId: string,
    templateId: string
  ): Promise<void> {
    await this.withStore<undefined>(
      storeNames.templates,
      "readwrite",
      (store) => store.delete([projectId, templateId])
    );
  }

  private async readAssetRecord(
    projectId: string,
    assetId: string
  ): Promise<AssetRecord | null> {
    const record = await this.withStore<AssetRecord | undefined>(
      storeNames.assets,
      "readonly",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      (store) => store.get([projectId, assetId])
    );
    return record ?? null;
  }
}
