import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteIndexedDatabase } from "../indexeddb.adapter";
import { s3CacheDatabaseName } from "../s3.adapter";
import { readSyncMeta, writeSyncMeta } from "../s3/sync-meta";

describe("S3 sync metadata persistence", () => {
  beforeEach(async () => {
    await deleteIndexedDatabase({
      databaseNameOverride: s3CacheDatabaseName,
    });
  });

  afterEach(async () => {
    await deleteIndexedDatabase({
      databaseNameOverride: s3CacheDatabaseName,
    });
  });

  it("writes and reads sync telemetry", async () => {
    await writeSyncMeta(
      {
        state: "syncing",
        pendingCount: 2,
        lastSuccessAt: 123,
        lastError: "network: Failed to fetch",
        lastInitResolution: "remote_applied",
      },
      s3CacheDatabaseName
    );

    const stored = await readSyncMeta(s3CacheDatabaseName);
    expect(stored).not.toBeNull();
    expect(stored?.status).toMatchObject({
      state: "syncing",
      pendingCount: 2,
      lastSuccessAt: 123,
      lastError: "network: Failed to fetch",
      lastInitResolution: "remote_applied",
    });
    expect(stored?.updatedAt).toBeTypeOf("number");
  });

  it("returns null when no telemetry exists", async () => {
    const stored = await readSyncMeta(s3CacheDatabaseName);
    expect(stored).toBeNull();
  });
});
