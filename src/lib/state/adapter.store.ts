import { get, writable } from "svelte/store";
import { FileSystemAdapter } from "$lib/core/storage/filesystem.adapter";
import { IndexedDBAdapter } from "$lib/core/storage/indexeddb.adapter";
import type { S3Adapter as S3AdapterClass } from "$lib/core/storage/s3.adapter";
import type { S3Config, StorageAdapter } from "$lib/core/storage/types";

export type StorageMode = "filesystem" | "idb" | "s3";

export const storageMode = writable<StorageMode>("idb");
export const adapter = writable<StorageAdapter>(new IndexedDBAdapter());

type AdapterInitOptions = {
  directoryHandle?: FileSystemDirectoryHandle;
  s3Config?: S3Config;
  s3RequestTimeoutMs?: number;
};

export const getAdapter = (): StorageAdapter => get(adapter);

let s3AdapterModulePromise: Promise<S3AdapterModule> | null = null;

type S3AdapterModule = {
  S3Adapter: typeof S3AdapterClass;
};

const loadS3AdapterModule = async (): Promise<S3AdapterModule> => {
  if (s3AdapterModulePromise) {
    return s3AdapterModulePromise;
  }
  // eslint-disable-next-line import/dynamic-import-chunkname
  s3AdapterModulePromise = import("$lib/core/storage/s3.adapter");
  return s3AdapterModulePromise;
};

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
    throw new Error("S3 adapter requires async initialization.");
  }
  storageMode.set(mode);
  adapter.set(nextAdapter);
  return nextAdapter;
};

export const initAdapterAsync = async (
  mode: StorageMode,
  options: AdapterInitOptions = {}
): Promise<StorageAdapter> => {
  if (mode !== "s3") {
    return initAdapter(mode, options);
  }
  if (!options.s3Config) {
    throw new Error("S3 storage requires configuration.");
  }
  const { S3Adapter } = await loadS3AdapterModule();
  const nextAdapter = new S3Adapter(options.s3Config, {
    requestTimeoutMs: options.s3RequestTimeoutMs,
  });
  storageMode.set("s3");
  adapter.set(nextAdapter);
  return nextAdapter;
};

export const switchAdapter = (
  mode: StorageMode,
  options: AdapterInitOptions = {}
): StorageAdapter => initAdapter(mode, options);
