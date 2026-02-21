/* eslint-disable sonarjs/arrow-function-convention */
import { openIndexedDatabase } from "../indexeddb/database";
import { requestToPromise, waitForTransaction } from "../indexeddb/requests";
import { storeNames } from "../indexeddb/schema";

export type SyncOutboxKind =
  | "vault"
  | "note"
  | "template"
  | "asset"
  | "searchIndex"
  | "uiState"
  | "deleteNotePermanent"
  | "deleteTemplate";

export type SyncOutboxItem = {
  key: string;
  kind: SyncOutboxKind;
  id?: string;
  queuedAt: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isOutboxItem = (value: unknown): value is SyncOutboxItem => {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.key !== "string" || value.key.length === 0) {
    return false;
  }
  if (typeof value.kind !== "string" || value.kind.length === 0) {
    return false;
  }
  if (typeof value.queuedAt !== "number") {
    return false;
  }
  if (value.id !== undefined && typeof value.id !== "string") {
    return false;
  }
  return true;
};

const withOutboxStore = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
  databaseNameOverride?: string
): Promise<T> => {
  const database = await openIndexedDatabase({ databaseNameOverride });
  try {
    const transaction = database.transaction(storeNames.syncOutbox, mode);
    const store = transaction.objectStore(storeNames.syncOutbox);
    const request = operation(store);
    const result = await requestToPromise(request);
    await waitForTransaction(transaction);
    return result;
  } finally {
    database.close();
  }
};

export const putOutboxItem = async (
  item: Omit<SyncOutboxItem, "queuedAt"> & { queuedAt?: number },
  databaseNameOverride?: string
): Promise<void> => {
  const payload: SyncOutboxItem = {
    ...item,
    queuedAt: item.queuedAt ?? Date.now(),
  };
  await withOutboxStore(
    "readwrite",
    (store) => store.put(payload),
    databaseNameOverride
  );
};

export const listOutboxItems = async (
  databaseNameOverride?: string
): Promise<SyncOutboxItem[]> => {
  const stored = await withOutboxStore<unknown[]>(
    "readonly",
    (store) => store.getAll(),
    databaseNameOverride
  );
  if (!Array.isArray(stored)) {
    return [];
  }
  return stored.filter(isOutboxItem);
};

export const deleteOutboxItem = async (
  key: string,
  databaseNameOverride?: string
): Promise<void> => {
  await withOutboxStore(
    "readwrite",
    (store) => store.delete(key),
    databaseNameOverride
  );
};
