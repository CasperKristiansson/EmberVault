import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteIndexedDatabase,
  IndexedDBAdapter,
  openIndexedDatabase,
  storeKeyPaths,
  storeNames,
} from "../indexeddb.adapter";

const expectedStoreNames = Object.values(storeNames);

let openedDatabase: IDBDatabase | null = null;

const closeOpenedDatabase = (): void => {
  if (!openedDatabase) {
    return;
  }
  openedDatabase.close();
  openedDatabase = null;
};

const openDatabase = async (): Promise<IDBDatabase> => {
  const database = await openIndexedDatabase();
  openedDatabase = database;
  return database;
};

describe("IndexedDBAdapter", () => {
  beforeEach(async () => {
    closeOpenedDatabase();
    await deleteIndexedDatabase();
  });

  afterEach(async () => {
    closeOpenedDatabase();
    await deleteIndexedDatabase();
  });

  it("creates the expected object stores", async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    const database = await openDatabase();
    const storeNamesList = [...database.objectStoreNames];

    expect(storeNamesList).toHaveLength(expectedStoreNames.length);
    for (const storeName of expectedStoreNames) {
      expect(storeNamesList).toContain(storeName);
    }

    for (const storeName of expectedStoreNames) {
      const store = database
        .transaction(storeName, "readonly")
        .objectStore(storeName);
      expect(store.keyPath).toEqual(storeKeyPaths[storeName]);
    }
  });
});
