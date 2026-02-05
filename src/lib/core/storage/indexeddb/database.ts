import { createObjectStores, databaseName, databaseVersion } from "./schema";
import { requestToPromise } from "./requests";

const getDatabaseFactory = (): IDBFactory => globalThis.indexedDB;

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
