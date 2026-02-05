import { get, writable } from "svelte/store";
import { FileSystemAdapter } from "$lib/core/storage/filesystem.adapter";
import { IndexedDBAdapter } from "$lib/core/storage/indexeddb.adapter";
import type { StorageAdapter } from "$lib/core/storage/types";

export type StorageMode = "filesystem" | "idb";

export const storageMode = writable<StorageMode>("idb");
export const adapter = writable<StorageAdapter>(new IndexedDBAdapter());

type AdapterInitOptions = {
  directoryHandle?: FileSystemDirectoryHandle;
};

export const getAdapter = (): StorageAdapter => get(adapter);

export const initAdapter = (
  mode: StorageMode,
  options: AdapterInitOptions = {}
): StorageAdapter => {
  let nextAdapter: StorageAdapter = new IndexedDBAdapter();
  if (mode === "filesystem") {
    if (!options.directoryHandle) {
      throw new Error("File system storage requires a directory handle.");
    }
    nextAdapter = new FileSystemAdapter(options.directoryHandle);
  }
  storageMode.set(mode);
  adapter.set(nextAdapter);
  return nextAdapter;
};

export const switchAdapter = (
  mode: StorageMode,
  options: AdapterInitOptions = {}
): StorageAdapter => initAdapter(mode, options);
