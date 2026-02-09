export const databaseName = "local-notes";
export const databaseVersion = 2;

export const storeNames = {
  projects: "projects",
  notes: "notes",
  templates: "templates",
  assets: "assets",
  uiState: "uiState",
  searchIndex: "searchIndex",
  appSettings: "appSettings",
} as const;

export type StoreName = (typeof storeNames)[keyof typeof storeNames];

export type StoreKeyPath = string | string[] | null;

const projectIdKey = "projectId";
const noteIdKey = "noteId";
const templateIdKey = "templateId";
const assetIdKey = "assetId";
const primaryIdKey = "id";

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
  [storeNames.appSettings]: null,
};

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

export const createObjectStores = (database: IDBDatabase): void => {
  const storeList: StoreName[] = [
    storeNames.projects,
    storeNames.notes,
    storeNames.templates,
    storeNames.assets,
    storeNames.uiState,
    storeNames.searchIndex,
    storeNames.appSettings,
  ];

  for (const storeName of storeList) {
    ensureObjectStore(database, storeName, storeKeyPaths[storeName]);
  }
};
export const uiStateKey = "ui";
export const appSettingsKey = "app";
