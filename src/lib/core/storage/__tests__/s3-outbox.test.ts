import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteIndexedDatabase } from "../indexeddb.adapter";
import {
  listOutboxItems,
  markOutboxItemAttempt,
  putOutboxItem,
} from "../s3/outbox";
import { s3CacheDatabaseName } from "../s3.adapter";

describe("S3 outbox metadata", () => {
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

  it("defaults retry metadata for legacy/minimal outbox entries", async () => {
    await putOutboxItem(
      {
        key: "vault",
        kind: "vault",
      },
      s3CacheDatabaseName
    );

    const outbox = await listOutboxItems(s3CacheDatabaseName);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      key: "vault",
      kind: "vault",
      retryCount: 0,
      lastAttemptAt: null,
      lastError: null,
    });
  });

  it("updates retry metadata after failed attempts", async () => {
    await putOutboxItem(
      {
        key: "note:123",
        kind: "note",
        id: "123",
      },
      s3CacheDatabaseName
    );

    await markOutboxItemAttempt(
      {
        key: "note:123",
        lastError: "network: Failed to fetch",
      },
      s3CacheDatabaseName
    );

    const outbox = await listOutboxItems(s3CacheDatabaseName);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.retryCount).toBe(1);
    expect(outbox[0]?.lastAttemptAt).toBeTypeOf("number");
    expect(outbox[0]?.lastError).toBe("network: Failed to fetch");
  });
});
