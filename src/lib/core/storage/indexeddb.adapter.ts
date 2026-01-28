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

type StoreName = (typeof storeNames)[keyof typeof storeNames];

type StoreKeyPath = string | string[] | null;

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

export class IndexedDBAdapter implements StorageAdapter {
  private readonly adapterDatabaseName = databaseName;

  public async init(): Promise<void> {
    await this.openAndCloseDatabase();
  }

  public async listProjects(): Promise<Project[]> {
    await this.openAndCloseDatabase();
    throw new Error("IndexedDBAdapter.listProjects is not implemented yet.");
  }

  public async createProject(project: Project): Promise<void> {
    await this.openAndCloseDatabase();
    throw new Error(
      `IndexedDBAdapter.createProject is not implemented for ${project.id}.`
    );
  }

  public async readProject(projectId: string): Promise<Project | null> {
    await this.openAndCloseDatabase();
    throw new Error(
      `IndexedDBAdapter.readProject is not implemented for ${projectId}.`
    );
  }

  public async writeProject(
    projectId: string,
    projectMeta: Project
  ): Promise<void> {
    await this.openAndCloseDatabase();
    throw new Error(
      `IndexedDBAdapter.writeProject is not implemented for ${projectId}:${projectMeta.id}.`
    );
  }

  public async listNotes(projectId: string): Promise<NoteIndexEntry[]> {
    await this.openAndCloseDatabase();
    throw new Error(
      `IndexedDBAdapter.listNotes is not implemented for ${projectId}.`
    );
  }

  public async readNote(
    projectId: string,
    noteId: string
  ): Promise<NoteDocumentFile | null> {
    await this.openAndCloseDatabase();
    throw new Error(
      `IndexedDBAdapter.readNote is not implemented for ${projectId}:${noteId}.`
    );
  }

  public async writeNote(input: {
    projectId: string;
    noteId: string;
    noteDocument: NoteDocumentFile;
    derivedMarkdown: string;
  }): Promise<void> {
    await this.openAndCloseDatabase();
    throw new Error(
      `IndexedDBAdapter.writeNote is not implemented for ${input.projectId}:${input.noteId}.`
    );
  }

  public async deleteNoteSoft(
    projectId: string,
    noteId: string
  ): Promise<void> {
    await this.openAndCloseDatabase();
    throw new Error(
      `IndexedDBAdapter.deleteNoteSoft is not implemented for ${projectId}:${noteId}.`
    );
  }

  public async restoreNote(projectId: string, noteId: string): Promise<void> {
    await this.openAndCloseDatabase();
    throw new Error(
      `IndexedDBAdapter.restoreNote is not implemented for ${projectId}:${noteId}.`
    );
  }

  public async deleteNotePermanent(
    projectId: string,
    noteId: string
  ): Promise<void> {
    await this.openAndCloseDatabase();
    throw new Error(
      `IndexedDBAdapter.deleteNotePermanent is not implemented for ${projectId}:${noteId}.`
    );
  }

  public async writeAsset(input: {
    projectId: string;
    assetId: string;
    blob: Blob;
    meta?: AssetMeta;
  }): Promise<void> {
    await this.openAndCloseDatabase();
    throw new Error(
      `IndexedDBAdapter.writeAsset is not implemented for ${input.projectId}:${input.assetId}.`
    );
  }

  public async readAsset(
    projectId: string,
    assetId: string
  ): Promise<Blob | null> {
    await this.openAndCloseDatabase();
    throw new Error(
      `IndexedDBAdapter.readAsset is not implemented for ${projectId}:${assetId}.`
    );
  }

  public async listAssets(projectId: string): Promise<string[]> {
    await this.openAndCloseDatabase();
    throw new Error(
      `IndexedDBAdapter.listAssets is not implemented for ${projectId}.`
    );
  }

  public async writeUIState(state: UIState): Promise<void> {
    await this.openAndCloseDatabase();
    throw new Error(
      `IndexedDBAdapter.writeUIState is not implemented for ${JSON.stringify(state)}.`
    );
  }

  public async readUIState(): Promise<UIState | null> {
    await this.openAndCloseDatabase();
    throw new Error("IndexedDBAdapter.readUIState is not implemented yet.");
  }

  private async openAndCloseDatabase(): Promise<void> {
    const database = await openIndexedDatabase();
    if (database.name !== this.adapterDatabaseName) {
      database.close();
      return;
    }
    database.close();
  }
}
