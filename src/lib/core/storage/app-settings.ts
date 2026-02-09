import { openIndexedDatabase } from "./indexeddb/database";
import { requestToPromise, waitForTransaction } from "./indexeddb/requests";
import { appSettingsKey, storeNames } from "./indexeddb/schema";
import type { AppSettings } from "./types";

const isIndexedDbAvailable = (): boolean =>
  typeof globalThis !== "undefined" && "indexedDB" in globalThis;

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
  if (!isIndexedDbAvailable()) {
    return null;
  }
  try {
    const stored = await withAppSettingsStore<AppSettings | undefined>(
      "readonly",
      (store) => store.get(appSettingsKey)
    );
    return stored ?? null;
  } catch {
    return null;
  }
};

export const writeAppSettings = async (
  settings: AppSettings
): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    return;
  }
  await withAppSettingsStore("readwrite", (store) =>
    store.put(settings, appSettingsKey)
  );
};

export const clearAppSettings = async (): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    return;
  }
  await withAppSettingsStore("readwrite", (store) =>
    store.delete(appSettingsKey)
  );
};
