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
  retryCount: number;
  lastAttemptAt: number | null;
  lastError: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string";

const isOptionalNullableString = (
  value: unknown
): value is string | null | undefined =>
  value === undefined || value === null || typeof value === "string";

const isOptionalNumber = (value: unknown): value is number | undefined =>
  value === undefined || typeof value === "number";

const isOptionalNullableNumber = (
  value: unknown
): value is number | null | undefined =>
  value === undefined || value === null || typeof value === "number";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isOutboxItem = (value: unknown): value is SyncOutboxItem => {
  if (!isRecord(value)) {
    return false;
  }
  if (!isNonEmptyString(value.key)) {
    return false;
  }
  if (!isNonEmptyString(value.kind)) {
    return false;
  }
  if (typeof value.queuedAt !== "number") {
    return false;
  }
  const optionalChecks = [
    isOptionalString(value.id),
    isOptionalNumber(value.retryCount),
    isOptionalNullableNumber(value.lastAttemptAt),
    isOptionalNullableString(value.lastError),
  ];
  return optionalChecks.every(Boolean);
};

const toOutboxItem = (
  value: Omit<SyncOutboxItem, "retryCount" | "lastAttemptAt" | "lastError"> & {
    retryCount?: number;
    lastAttemptAt?: number | null;
    lastError?: string | null;
  }
): SyncOutboxItem => ({
  ...value,
  retryCount: value.retryCount ?? 0,
  lastAttemptAt: value.lastAttemptAt ?? null,
  lastError: value.lastError ?? null,
});

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
  item: Omit<
    SyncOutboxItem,
    "queuedAt" | "retryCount" | "lastAttemptAt" | "lastError"
  > & {
    queuedAt?: number;
    retryCount?: number;
    lastAttemptAt?: number | null;
    lastError?: string | null;
  },
  databaseNameOverride?: string
): Promise<void> => {
  const payload = toOutboxItem({
    ...item,
    queuedAt: item.queuedAt ?? Date.now(),
  });
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
  return stored.filter(isOutboxItem).map((item) => toOutboxItem(item));
};

export const markOutboxItemAttempt = async (
  input: {
    key: string;
    lastError: string | null;
  },
  databaseNameOverride?: string
): Promise<void> => {
  const existing = await withOutboxStore<unknown>(
    "readonly",
    (store) => store.get(input.key),
    databaseNameOverride
  );
  if (!isOutboxItem(existing)) {
    return;
  }
  const item = toOutboxItem(existing);
  const updated = toOutboxItem({
    ...item,
    retryCount: item.retryCount + 1,
    lastAttemptAt: Date.now(),
    lastError: input.lastError,
  });
  await withOutboxStore(
    "readwrite",
    (store) => store.put(updated),
    databaseNameOverride
  );
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
