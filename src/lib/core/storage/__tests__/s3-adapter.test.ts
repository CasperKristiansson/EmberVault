import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { deleteIndexedDatabase } from "../indexeddb.adapter";
import { listOutboxItems } from "../s3/outbox";
import { S3Adapter } from "../s3.adapter";
import type { S3Transport } from "../s3.adapter";
import type { NoteDocumentFile } from "../types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const commandKey = (command: unknown): string | null => {
  if (!isRecord(command)) {
    return null;
  }
  const { input } = command;
  if (!isRecord(input)) {
    return null;
  }
  return typeof input.Key === "string" ? input.Key : null;
};

const createNotFoundError = (): Error & {
  $metadata: { httpStatusCode: number };
} => {
  const error = new Error("NotFound") as Error & {
    $metadata: { httpStatusCode: number };
  };
  error.$metadata = { httpStatusCode: 404 };
  return error;
};

describe("S3Adapter", () => {
  beforeEach(async () => {
    await deleteIndexedDatabase();
  });

  it("creates and uploads a vault when none exists remotely", async () => {
    const send = vi.fn(
      // eslint-disable-next-line @typescript-eslint/require-await
      async (command: unknown) => {
        if (command instanceof GetObjectCommand) {
          throw createNotFoundError();
        }
        if (command instanceof PutObjectCommand) {
          return {};
        }
        if (command instanceof DeleteObjectCommand) {
          return {};
        }
        if (command instanceof ListObjectsV2Command) {
          return { Contents: [] };
        }
        return {};
      }
    );

    const client = { send } satisfies S3Transport;
    const adapter = new S3Adapter(
      {
        bucket: "bucket",
        region: "us-east-1",
        prefix: "embervault/",
        accessKeyId: "AKIA_TEST",
        secretAccessKey: "SECRET_TEST",
      },
      { client }
    );

    await adapter.init();

    const putCalls = send.mock.calls.filter(
      ([command]) => command instanceof PutObjectCommand
    );
    expect(putCalls.length).toBeGreaterThan(0);
    const putKeys = putCalls
      .map(([command]) => commandKey(command))
      .filter((key): key is string => typeof key === "string");
    // eslint-disable-next-line sonarjs/arrow-function-convention
    expect(putKeys.some((key) => key.endsWith("vault.json"))).toBe(true);
  });

  it("flushes note and vault updates", async () => {
    const send = vi.fn(
      // eslint-disable-next-line @typescript-eslint/require-await
      async (command: unknown) => {
        if (command instanceof GetObjectCommand) {
          throw createNotFoundError();
        }
        if (command instanceof PutObjectCommand) {
          return {};
        }
        return {};
      }
    );

    const client = { send } satisfies S3Transport;
    const adapter = new S3Adapter(
      {
        bucket: "bucket",
        region: "us-east-1",
        prefix: "embervault/",
        accessKeyId: "AKIA_TEST",
        secretAccessKey: "SECRET_TEST",
      },
      { client }
    );

    await adapter.init();
    send.mockClear();

    const note: NoteDocumentFile = {
      id: "note-1",
      title: "Title",
      createdAt: 1,
      updatedAt: 2,
      folderId: null,
      tagIds: [],
      favorite: false,
      deletedAt: null,
      customFields: {},
      pmDoc: { type: "doc", content: [] },
      derived: { plainText: "Body", outgoingLinks: [] },
    };

    await adapter.writeNote({
      noteId: note.id,
      noteDocument: note,
      derivedMarkdown: "# Title\n\nBody",
    });

    await adapter.flushNowForTests();

    const putKeys = send.mock.calls
      .filter(([command]) => command instanceof PutObjectCommand)
      .map(([command]) => commandKey(command))
      .filter((key): key is string => typeof key === "string");

    expect(putKeys).toContain("embervault/notes/note-1.json");
    expect(putKeys).toContain("embervault/notes/note-1.md");
    expect(putKeys).toContain("embervault/vault.json");

    expect(await listOutboxItems()).toHaveLength(0);
  });
});
