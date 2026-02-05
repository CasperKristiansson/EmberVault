import { describe, expect, it } from "vitest";
import { get } from "svelte/store";
import { FileSystemAdapter } from "$lib/core/storage/filesystem.adapter";
import { IndexedDBAdapter } from "$lib/core/storage/indexeddb.adapter";
import { adapter, initAdapter, storageMode } from "$lib/state/adapter.store";

describe("adapter.store", () => {
  it("initializes the IndexedDB adapter", () => {
    const activeAdapter = initAdapter("idb");
    expect(activeAdapter).toBeInstanceOf(IndexedDBAdapter);
    expect(get(storageMode)).toBe("idb");
    expect(get(adapter)).toBe(activeAdapter);
  });

  it("requires a folder handle for filesystem mode", () => {
    expect(() => initAdapter("filesystem")).toThrow(
      "File system storage requires a directory handle."
    );
  });

  it("initializes the FileSystem adapter with a directory handle", () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const handle = {} as FileSystemDirectoryHandle;
    const activeAdapter = initAdapter("filesystem", {
      directoryHandle: handle,
    });
    expect(activeAdapter).toBeInstanceOf(FileSystemAdapter);
    expect(get(storageMode)).toBe("filesystem");
    expect(get(adapter)).toBe(activeAdapter);
  });
});
