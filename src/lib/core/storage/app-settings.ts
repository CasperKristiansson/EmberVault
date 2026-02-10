/* eslint-disable sonarjs/arrow-function-convention */
import { openIndexedDatabase } from "./indexeddb/database";
import { requestToPromise, waitForTransaction } from "./indexeddb/requests";
import { appSettingsKey, storeNames } from "./indexeddb/schema";
import type { AppSettings } from "./types";

const isIndexedDatabaseAvailable = (): boolean =>
  typeof globalThis !== "undefined" && "indexedDB" in globalThis;

const hasStorageMode = (value: unknown): value is { storageMode: unknown } =>
  typeof value === "object" && value !== null && "storageMode" in value;

const isAppSettings = (value: unknown): value is AppSettings => {
  if (!hasStorageMode(value)) {
    return false;
  }
  return value.storageMode === "filesystem" || value.storageMode === "idb";
};

const withAppSettingsStore = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const database = await openIndexedDatabase();
  try {
    const transaction = database.transaction(storeNames.appSettings, mode);
    const store = transaction.objectStore(storeNames.appSettings);
    const request = operation(store);
    const result = await requestToPromise(request);
    await waitForTransaction(transaction);
    return result;
  } finally {
    database.close();
  }
};

export const readAppSettings = async (): Promise<AppSettings | null> => {
  if (!isIndexedDatabaseAvailable()) {
    return null;
  }
  try {
    const stored = await withAppSettingsStore<unknown>("readonly", (store) =>
      store.get(appSettingsKey)
    );
    return isAppSettings(stored) ? stored : null;
  } catch {
    return null;
  }
};

export const writeAppSettings = async (
  settings: AppSettings
): Promise<void> => {
  if (!isIndexedDatabaseAvailable()) {
    return;
  }
  await withAppSettingsStore("readwrite", (store) =>
    store.put(settings, appSettingsKey)
  );
};

export const clearAppSettings = async (): Promise<void> => {
  if (!isIndexedDatabaseAvailable()) {
    return;
  }
  await withAppSettingsStore("readwrite", (store) =>
    store.delete(appSettingsKey)
  );
};
