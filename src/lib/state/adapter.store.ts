import { get, writable } from "svelte/store";
import { FileSystemAdapter } from "$lib/core/storage/filesystem.adapter";
import { IndexedDBAdapter } from "$lib/core/storage/indexeddb.adapter";
import { S3Adapter } from "$lib/core/storage/s3.adapter";
import type { S3Config, StorageAdapter } from "$lib/core/storage/types";

export type StorageMode = "filesystem" | "idb" | "s3";

export const storageMode = writable<StorageMode>("idb");
export const adapter = writable<StorageAdapter>(new IndexedDBAdapter());

type AdapterInitOptions = {
  directoryHandle?: FileSystemDirectoryHandle;
  s3Config?: S3Config;
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
  if (mode === "s3") {
    if (!options.s3Config) {
      throw new Error("S3 storage requires configuration.");
    }
    nextAdapter = new S3Adapter(options.s3Config);
  }
  storageMode.set(mode);
  adapter.set(nextAdapter);
  return nextAdapter;
};

export const switchAdapter = (
  mode: StorageMode,
  options: AdapterInitOptions = {}
): StorageAdapter => initAdapter(mode, options);
