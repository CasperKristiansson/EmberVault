/* eslint-disable sonarjs/arrow-function-convention */
import { openIndexedDatabase } from "../indexeddb/database";
import { requestToPromise, waitForTransaction } from "../indexeddb/requests";
import { storeNames, syncMetaKey } from "../indexeddb/schema";
import type { SyncStatus } from "../types";

export type PersistedSyncMeta = {
  status: SyncStatus;
  updatedAt: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSyncStatusState = (value: unknown): value is SyncStatus["state"] =>
  value === "idle" ||
  value === "syncing" ||
  value === "offline" ||
  value === "error";

const isInitResolution = (
  value: unknown
): value is SyncStatus["lastInitResolution"] =>
  value === "remote_applied" ||
  value === "local_pushed" ||
  value === "created_default" ||
  value === null;

const isSyncStatus = (value: unknown): value is SyncStatus => {
  if (!isRecord(value)) {
    return false;
  }
  const checks = [
    isSyncStatusState(value.state) && typeof value.pendingCount === "number",
    typeof value.lastSuccessAt === "number" || value.lastSuccessAt === null,
    typeof value.lastError === "string" || value.lastError === null,
    isInitResolution(value.lastInitResolution),
  ];
  return checks.every(Boolean);
};

const isPersistedSyncMeta = (value: unknown): value is PersistedSyncMeta => {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.updatedAt === "number" && isSyncStatus(value.status);
};

const withSyncMetaStore = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
  databaseNameOverride?: string
): Promise<T> => {
  const database = await openIndexedDatabase({ databaseNameOverride });
  try {
    const transaction = database.transaction(storeNames.syncMeta, mode);
    const store = transaction.objectStore(storeNames.syncMeta);
    const request = operation(store);
    const result = await requestToPromise(request);
    await waitForTransaction(transaction);
    return result;
  } finally {
    database.close();
  }
};

export const readSyncMeta = async (
  databaseNameOverride?: string
): Promise<PersistedSyncMeta | null> => {
  const stored = await withSyncMetaStore<unknown>(
    "readonly",
    (store) => store.get(syncMetaKey),
    databaseNameOverride
  );
  return isPersistedSyncMeta(stored) ? stored : null;
};

export const writeSyncMeta = async (
  status: SyncStatus,
  databaseNameOverride?: string
): Promise<void> => {
  const payload: PersistedSyncMeta = {
    status,
    updatedAt: Date.now(),
  };
  await withSyncMetaStore(
    "readwrite",
    (store) => store.put(payload, syncMetaKey),
    databaseNameOverride
  );
};
