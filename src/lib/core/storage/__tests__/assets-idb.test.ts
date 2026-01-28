import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDefaultProject,
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

    const project = createDefaultProject();
    await adapter.createProject(project);

    const blob = createBlob(assetPayload);
    await adapter.writeAsset({
      projectId: project.id,
      meta: { mime: "text/plain", size: blob.size },
      assetId,
      blob,
    });

    const storedBlob = await adapter.readAsset(project.id, assetId);
    expect(storedBlob).not.toBeNull();
    expect(storedBlob).toBeInstanceOf(Blob);
    expect(storedBlob?.size).toBeGreaterThan(0);
    expect(storedBlob?.type).toBe(blob.type);

    const assets = await adapter.listAssets(project.id);
    expect(assets).toEqual([assetId]);
  });

  it("dedupes assets by assetId", async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    const project = createDefaultProject();
    await adapter.createProject(project);

    const blob = createBlob(assetPayload);
    await adapter.writeAsset({
      projectId: project.id,
      assetId,
      blob,
    });
    await adapter.writeAsset({
      projectId: project.id,
      assetId,
      blob,
    });

    const assets = await adapter.listAssets(project.id);
    expect(assets).toEqual([assetId]);
  });
});
