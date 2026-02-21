import { createObjectStores, databaseName, databaseVersion } from "./schema";
import { requestToPromise } from "./requests";

const getDatabaseFactory = (): IDBFactory => globalThis.indexedDB;

export const openIndexedDatabase = async (options?: {
  databaseNameOverride?: string;
  databaseVersionOverride?: number;
}): Promise<IDBDatabase> => {
  const name = options?.databaseNameOverride ?? databaseName;
  const version = options?.databaseVersionOverride ?? databaseVersion;
  const databaseFactory = getDatabaseFactory();
  const request: IDBOpenDBRequest = databaseFactory.open(name, version);
  request.onupgradeneeded = () => {
    createObjectStores(request.result);
  };
  return requestToPromise(request);
};

export const deleteIndexedDatabase = async (options?: {
  databaseNameOverride?: string;
}): Promise<void> => {
  const name = options?.databaseNameOverride ?? databaseName;
  const databaseFactory = getDatabaseFactory();
  const request: IDBOpenDBRequest = databaseFactory.deleteDatabase(name);
  await requestToPromise(request);
};
