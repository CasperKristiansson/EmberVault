import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDefaultVault,
  deleteIndexedDatabase,
  IndexedDBAdapter,
} from "../indexeddb.adapter";

const assetId = "asset-1";
const assetPayload = "hello-asset";

const createBlob = (value: string): Blob =>
  new Blob([value], { type: "text/plain" });

describe("IndexedDBAdapter asset persistence", () => {
  beforeEach(async () => {
    await deleteIndexedDatabase();
  });

  afterEach(async () => {
    await deleteIndexedDatabase();
  });

  it("writes, reads, and lists assets", async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    const vault = createDefaultVault();
    await adapter.writeVault(vault);

    const blob = createBlob(assetPayload);
    await adapter.writeAsset({
      meta: { mime: "text/plain", size: blob.size },
      assetId,
      blob,
    });

    const storedBlob = await adapter.readAsset(assetId);
    expect(storedBlob).not.toBeNull();
    expect(storedBlob).toBeInstanceOf(Blob);
    expect(storedBlob?.size).toBeGreaterThan(0);
    expect(storedBlob?.type).toBe(blob.type);

    const assets = await adapter.listAssets();
    expect(assets).toEqual([assetId]);
  });

  it("dedupes assets by assetId", async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    const vault = createDefaultVault();
    await adapter.writeVault(vault);

    const blob = createBlob(assetPayload);
    await adapter.writeAsset({
      assetId,
      blob,
    });
    await adapter.writeAsset({
      assetId,
      blob,
    });

    const assets = await adapter.listAssets();
    expect(assets).toEqual([assetId]);
  });
});
