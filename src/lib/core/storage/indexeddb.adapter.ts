/* eslint-disable sonarjs/arrow-function-convention */
import { createUlid } from "../utils/ulid";
import type {
  AssetMeta,
  NoteDocumentFile,
  NoteIndexEntry,
  Project,
  StorageAdapter,
  UIState,
} from "./types";

export const databaseName = "local-notes";
export const databaseVersion = 1;

export const storeNames = {
  projects: "projects",
  notes: "notes",
  templates: "templates",
  assets: "assets",
  uiState: "uiState",
  searchIndex: "searchIndex",
} as const;

const projectIdKey = "projectId";
const noteIdKey = "noteId";
const templateIdKey = "templateId";
const assetIdKey = "assetId";
const primaryIdKey = "id";
const uiStateKey = "ui";

type StoreName = (typeof storeNames)[keyof typeof storeNames];

type StoreKeyPath = string | string[] | null;

type IndexedDatabaseKey = IDBValidKey;

type NoteRecord = {
  projectId: string;
  noteId: string;
  noteDocument: NoteDocumentFile;
  derivedMarkdown: string;
};

type AssetRecord = {
  projectId: string;
  assetId: string;
  blob: Blob;
  meta?: AssetMeta;
  bytes?: ArrayBuffer;
};

const noteKeyPath: string[] = [projectIdKey, noteIdKey];
const templateKeyPath: string[] = [projectIdKey, templateIdKey];
const assetKeyPath: string[] = [projectIdKey, assetIdKey];

export const storeKeyPaths: Record<StoreName, StoreKeyPath> = {
  [storeNames.projects]: primaryIdKey,
  [storeNames.notes]: noteKeyPath,
  [storeNames.templates]: templateKeyPath,
  [storeNames.assets]: assetKeyPath,
  [storeNames.uiState]: null,
  [storeNames.searchIndex]: projectIdKey,
};

const getDatabaseFactory = (): IDBFactory => globalThis.indexedDB;

const ensureObjectStore = (
  database: IDBDatabase,
  storeName: StoreName,
  keyPath: StoreKeyPath
): void => {
  if (database.objectStoreNames.contains(storeName)) {
    return;
  }
  if (keyPath === null) {
    database.createObjectStore(storeName);
    return;
  }
  database.createObjectStore(storeName, { keyPath });
};

const createObjectStores = (database: IDBDatabase): void => {
  const storeList: StoreName[] = [
    storeNames.projects,
    storeNames.notes,
    storeNames.templates,
    storeNames.assets,
    storeNames.uiState,
    storeNames.searchIndex,
  ];

  for (const storeName of storeList) {
    ensureObjectStore(database, storeName, storeKeyPaths[storeName]);
  }
};

const requestToPromise = async <T>(request: IDBRequest<T>): Promise<T> => {
  // eslint-disable-next-line promise/avoid-new, compat/compat, sonarjs/prefer-immediate-return
  const result = await new Promise<T>((resolve, reject) => {
    request.addEventListener("success", () => {
      resolve(request.result);
    });
    request.addEventListener("error", () => {
      reject(new Error("IndexedDB request failed."));
    });
  });
  return result;
};

const waitForTransaction = async (
  transaction: IDBTransaction
): Promise<void> => {
  // eslint-disable-next-line promise/avoid-new, compat/compat
  await new Promise<void>((resolve, reject) => {
    transaction.addEventListener("complete", () => {
      resolve();
    });
    transaction.addEventListener("abort", () => {
      reject(new Error("IndexedDB transaction aborted."));
    });
    transaction.addEventListener("error", () => {
      reject(new Error("IndexedDB transaction failed."));
    });
  });
};

export const openIndexedDatabase = async (): Promise<IDBDatabase> => {
  const databaseFactory = getDatabaseFactory();
  const request: IDBOpenDBRequest = databaseFactory.open(
    databaseName,
    databaseVersion
  );
  request.onupgradeneeded = () => {
    createObjectStores(request.result);
  };
  return requestToPromise(request);
};

export const deleteIndexedDatabase = async (): Promise<void> => {
  const databaseFactory = getDatabaseFactory();
  const request: IDBOpenDBRequest =
    databaseFactory.deleteDatabase(databaseName);
  await requestToPromise(request);
};

const defaultProjectName = "Personal";

export const createDefaultProject = (): Project => {
  const timestamp = Date.now();
  return {
    id: createUlid(),
    name: defaultProjectName,
    createdAt: timestamp,
    updatedAt: timestamp,
    folders: {},
    tags: {},
    notesIndex: {},
    templatesIndex: {},
    settings: {},
  };
};

const toNoteIndexEntry = (noteDocument: NoteDocumentFile): NoteIndexEntry => {
  const hasCustomFields = Object.keys(noteDocument.customFields).length > 0;
  return {
    id: noteDocument.id,
    title: noteDocument.title,
    folderId: noteDocument.folderId,
    tagIds: noteDocument.tagIds,
    favorite: noteDocument.favorite,
    createdAt: noteDocument.createdAt,
    updatedAt: noteDocument.updatedAt,
    deletedAt: noteDocument.deletedAt,
    isTemplate: false,
    ...(hasCustomFields ? { customFields: noteDocument.customFields } : {}),
    ...(noteDocument.derived?.outgoingLinks
      ? { linkOutgoing: noteDocument.derived.outgoingLinks }
      : {}),
  };
};

const toBlob = (value: unknown, meta?: AssetMeta): Blob => {
  const options = meta?.mime ? { type: meta.mime } : undefined;
  if (value instanceof Blob) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Blob([value], options);
  }
  if (value instanceof Uint8Array) {
    const copied = new Uint8Array(value);
    return new Blob([copied.buffer], options);
  }
  if (typeof value === "string") {
    return new Blob([value], options);
  }
  return new Blob([String(value)], options);
};

const toArrayBuffer = async (value: Blob): Promise<ArrayBuffer> => {
  if (typeof value.arrayBuffer === "function") {
    return value.arrayBuffer();
  }
  return new Response(value).arrayBuffer();
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

  public async readNote(
    projectId: string,
    noteId: string
  ): Promise<NoteDocumentFile | null> {
    const record = await this.readNoteRecord(projectId, noteId);
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
      blob: input.blob,
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

  private async writeNoteRecord(record: NoteRecord): Promise<void> {
    await this.withStore<IndexedDatabaseKey>(
      storeNames.notes,
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
