/* eslint-disable sonarjs/arrow-function-convention */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  createDefaultVault,
  deleteIndexedDatabase,
} from "../indexeddb.adapter";
import { listOutboxItems } from "../s3/outbox";
import { S3Adapter, s3CacheDatabaseName } from "../s3.adapter";
import type { S3Transport } from "../s3.adapter";
import type { NoteDocumentFile } from "../types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

type StoredBody = string | Blob | Uint8Array | ArrayBuffer;
type MockS3SeedEntry = [string, StoredBody];

type MockS3Transport = {
  client: S3Transport;
  send: ReturnType<typeof vi.fn>;
  objects: Map<string, StoredBody>;
  listCalls: Record<string, unknown>[];
};

const prefix = "embervault/";
const vaultKey = `${prefix}vault.json`;
const searchIndexKey = `${prefix}search-index.json`;
const uiStateKey = `${prefix}ui-state.json`;
const notesPrefix = `${prefix}notes/`;
const templatesPrefix = `${prefix}templates/`;
const assetsPrefix = `${prefix}assets/`;

const noteJsonKey = (noteId: string): string => `${notesPrefix}${noteId}.json`;
const noteMarkdownKey = (noteId: string): string =>
  `${notesPrefix}${noteId}.md`;
const templateJsonKey = (templateId: string): string =>
  `${templatesPrefix}${templateId}.json`;
const templateMarkdownKey = (templateId: string): string =>
  `${templatesPrefix}${templateId}.md`;
const assetKey = (assetId: string): string => `${assetsPrefix}${assetId}`;

const commandInput = (command: unknown): Record<string, unknown> => {
  if (!isRecord(command)) {
    return {};
  }
  return isRecord(command.input) ? command.input : {};
};

const commandKey = (command: unknown): string | null => {
  const input = commandInput(command);
  return typeof input.Key === "string" ? input.Key : null;
};

const commandBucket = (command: unknown): string | null => {
  const input = commandInput(command);
  return typeof input.Bucket === "string" ? input.Bucket : null;
};

const isStoredBody = (value: unknown): value is StoredBody =>
  typeof value === "string" ||
  value instanceof Blob ||
  value instanceof Uint8Array ||
  value instanceof ArrayBuffer;

const readStoredBodyAsText = async (value: StoredBody): Promise<string> => {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Blob) {
    return value.text();
  }
  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value);
  }
  return new TextDecoder().decode(new Uint8Array(value));
};

const createNotFoundError = (): Error & {
  $metadata: { httpStatusCode: number };
} => {
  const error = new Error("NotFound");
  return Object.assign(error, { $metadata: { httpStatusCode: 404 } });
};

const parseListInput = (
  input: Record<string, unknown>
): {
  keyPrefix: string;
  maxKeys: number;
  startIndex: number;
} => {
  const keyPrefix = typeof input.Prefix === "string" ? input.Prefix : "";
  const maxKeys =
    typeof input.MaxKeys === "number" && input.MaxKeys > 0
      ? input.MaxKeys
      : 1000;
  const continuationToken =
    typeof input.ContinuationToken === "string" ? input.ContinuationToken : "0";
  const parsedStartIndex = Number.parseInt(continuationToken, 10);

  return {
    keyPrefix,
    maxKeys,
    startIndex: Number.isFinite(parsedStartIndex) ? parsedStartIndex : 0,
  };
};

const listKeysForPrefix = (
  objects: Map<string, StoredBody>,
  keyPrefix: string
): string[] =>
  [...objects.keys()]
    .filter((key) => key.startsWith(keyPrefix))
    .toSorted((first, second) => first.localeCompare(second));

const handleGetObjectCommand = (
  command: unknown,
  objects: Map<string, StoredBody>
): { Body: StoredBody | undefined } => {
  const key = commandKey(command);
  if (!key || !objects.has(key)) {
    throw createNotFoundError();
  }
  return { Body: objects.get(key) };
};

const handlePutObjectCommand = (
  command: unknown,
  objects: Map<string, StoredBody>
): Record<string, never> => {
  const key = commandKey(command);
  if (!key) {
    return {};
  }
  const body = commandInput(command).Body;
  objects.set(key, isStoredBody(body) ? body : "");
  return {};
};

const handleDeleteObjectCommand = (
  command: unknown,
  objects: Map<string, StoredBody>
): Record<string, never> => {
  const key = commandKey(command);
  if (key) {
    objects.delete(key);
  }
  return {};
};

const handleListObjectCommand = (
  command: unknown,
  objects: Map<string, StoredBody>,
  listCalls: Record<string, unknown>[]
): {
  Contents: { Key: string }[];
  IsTruncated: boolean;
  NextContinuationToken: string | undefined;
} => {
  const input = commandInput(command);
  listCalls.push(input);

  const { keyPrefix, maxKeys, startIndex } = parseListInput(input);
  const filteredKeys = listKeysForPrefix(objects, keyPrefix);
  const pageKeys = filteredKeys.slice(startIndex, startIndex + maxKeys);
  const nextIndex = startIndex + pageKeys.length;
  const isTruncated = nextIndex < filteredKeys.length;

  return {
    Contents: pageKeys.map((key) => ({ Key: key })),
    IsTruncated: isTruncated,
    NextContinuationToken: isTruncated ? String(nextIndex) : undefined,
  };
};

const createMockS3Transport = (
  seed: MockS3SeedEntry[] = []
): MockS3Transport => {
  const objects = new Map<string, StoredBody>(seed);
  const listCalls: Record<string, unknown>[] = [];

  const send = vi.fn(
    // eslint-disable-next-line @typescript-eslint/require-await
    async (command: unknown) => {
      if (command instanceof GetObjectCommand) {
        return handleGetObjectCommand(command, objects);
      }
      if (command instanceof PutObjectCommand) {
        return handlePutObjectCommand(command, objects);
      }
      if (command instanceof DeleteObjectCommand) {
        return handleDeleteObjectCommand(command, objects);
      }
      if (command instanceof ListObjectsV2Command) {
        return handleListObjectCommand(command, objects, listCalls);
      }
      return {};
    }
  );

  const client = { send } satisfies S3Transport;
  return { client, send, objects, listCalls };
};

const createNote = (
  id: string,
  title: string,
  plainText: string
): NoteDocumentFile => ({
  id,
  title,
  createdAt: 1,
  updatedAt: 2,
  folderId: null,
  tagIds: [],
  favorite: false,
  deletedAt: null,
  customFields: {},
  pmDoc: { type: "doc", content: [] },
  derived: { plainText, outgoingLinks: [] },
});

const s3Config = {
  bucket: "bucket",
  region: "us-east-1",
  accessKeyId: "AKIA_TEST",
  secretAccessKey: "SECRET_TEST",
  prefix,
};

describe("S3Adapter", () => {
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

  it("creates and uploads a vault when none exists remotely", async () => {
    const { client, objects } = createMockS3Transport();
    const adapter = new S3Adapter(s3Config, { client });

    await adapter.init();

    expect(objects.has(vaultKey)).toBe(true);
    expect(await listOutboxItems(s3CacheDatabaseName)).toHaveLength(0);
  });

  it("normalizes bucket names that include s3 scheme syntax", async () => {
    const { client, send } = createMockS3Transport();
    const adapter = new S3Adapter(
      {
        ...s3Config,
        bucket: "s3://bucket/path-segment",
      },
      { client }
    );

    await adapter.init();
    await adapter.writeVault(createDefaultVault());
    await adapter.flushNowForTests();

    const bucketNames = send.mock.calls
      .map(([command]) => commandBucket(command))
      .filter((bucketName): bucketName is string => bucketName !== null);
    expect(new Set(bucketNames)).toEqual(new Set(["bucket"]));
  });

  it("flushes note, template, asset, ui-state, and search index updates", async () => {
    const { client, objects } = createMockS3Transport();
    const adapter = new S3Adapter(s3Config, { client });
    const noteId = "note-1";
    const templateId = "template-1";
    const templateTitle = "Template";
    const templateBody = "Template body";

    await adapter.init();

    const note = createNote(noteId, "Title", "Body");
    const template = createNote(templateId, templateTitle, templateBody);
    const image = new Blob(["image-bytes"], { type: "image/png" });

    await adapter.writeNote({
      noteId: note.id,
      noteDocument: note,
      derivedMarkdown: "# Title\n\nBody",
    });
    await adapter.writeTemplate({
      templateId: template.id,
      noteDocument: template,
      derivedMarkdown: `# ${templateTitle}\n\n${templateBody}`,
    });
    await adapter.writeAsset({
      assetId: "asset-1.png",
      blob: image,
      meta: { mime: "image/png", size: image.size },
    });
    await adapter.writeUIState({ workspaceState: { focusedPane: "primary" } });
    await adapter.writeSearchIndex('{"tokens":["title"]}');

    await adapter.flushNowForTests();

    expect(objects.has(noteJsonKey(noteId))).toBe(true);
    expect(objects.has(noteMarkdownKey(noteId))).toBe(true);
    expect(objects.has(templateJsonKey(templateId))).toBe(true);
    expect(objects.has(templateMarkdownKey(templateId))).toBe(true);
    expect(objects.has(assetKey("asset-1.png"))).toBe(true);
    expect(objects.has(uiStateKey)).toBe(true);
    expect(objects.has(searchIndexKey)).toBe(true);
    expect(objects.has(vaultKey)).toBe(true);

    const searchIndexBody = objects.get(searchIndexKey);
    if (!searchIndexBody) {
      throw new Error("Expected search index payload.");
    }
    expect(await readStoredBodyAsText(searchIndexBody)).toContain(
      '"tokens":["title"]'
    );
    expect(await listOutboxItems(s3CacheDatabaseName)).toHaveLength(0);
  });

  it("flushes delete operations for notes, templates, and assets", async () => {
    const { client, objects } = createMockS3Transport();
    const adapter = new S3Adapter(s3Config, { client });
    const noteToDelete = "note-delete";
    const templateToDelete = "template-delete";
    const assetToDelete = "asset-delete.png";

    await adapter.init();

    await adapter.writeNote({
      noteId: noteToDelete,
      noteDocument: createNote(noteToDelete, "Delete me", "Body"),
      derivedMarkdown: "# Delete me\n\nBody",
    });
    await adapter.writeTemplate({
      templateId: templateToDelete,
      noteDocument: createNote(templateToDelete, "Delete template", "Body"),
      derivedMarkdown: "# Delete template\n\nBody",
    });
    await adapter.writeAsset({
      assetId: assetToDelete,
      blob: new Blob(["img"]),
      meta: { size: 3 },
    });
    await adapter.flushNowForTests();

    expect(objects.has(noteJsonKey(noteToDelete))).toBe(true);
    expect(objects.has(templateJsonKey(templateToDelete))).toBe(true);
    expect(objects.has(assetKey(assetToDelete))).toBe(true);

    await adapter.deleteNotePermanent(noteToDelete);
    await adapter.deleteTemplate(templateToDelete);
    await adapter.deleteAsset(assetToDelete);
    await adapter.flushNowForTests();

    expect(objects.has(noteJsonKey(noteToDelete))).toBe(false);
    expect(objects.has(noteMarkdownKey(noteToDelete))).toBe(false);
    expect(objects.has(templateJsonKey(templateToDelete))).toBe(false);
    expect(objects.has(templateMarkdownKey(templateToDelete))).toBe(false);
    expect(objects.has(assetKey(assetToDelete))).toBe(false);
    expect(await listOutboxItems(s3CacheDatabaseName)).toHaveLength(0);
  });

  it("lists remote assets across paginated responses and merges local assets", async () => {
    const remoteAssetCount = 1002;
    const remoteAssets: string[] = [];
    for (let index = 0; index < remoteAssetCount; index += 1) {
      remoteAssets.push(`remote-${index}.png`);
    }
    const seed: MockS3SeedEntry[] = [
      [vaultKey, JSON.stringify({ ...createDefaultVault(), updatedAt: 2 })],
      ...remoteAssets.map(
        (remoteAssetId) =>
          [
            assetKey(remoteAssetId),
            new Blob([remoteAssetId]),
          ] as MockS3SeedEntry
      ),
    ];
    const { client, listCalls } = createMockS3Transport(seed);
    const adapter = new S3Adapter(s3Config, { client });

    await adapter.init();
    await adapter.writeAsset({
      assetId: "local-only.png",
      blob: new Blob(["local"]),
      meta: { size: 5 },
    });

    const assets = await adapter.listAssets();

    expect(assets.length).toBe(remoteAssetCount + 1);
    expect(assets).toEqual(
      expect.arrayContaining([
        "remote-0.png",
        "remote-1001.png",
        "local-only.png",
      ])
    );
    expect(listCalls.length).toBeGreaterThan(1);
    expect(listCalls[0]?.ContinuationToken).toBeUndefined();
    expect(listCalls[1]?.ContinuationToken).toBe("1000");
  });

  it("reads note, template, asset, ui-state, and search index from remote when cache is empty", async () => {
    const remoteNoteId = "remote-note";
    const remoteTemplateId = "remote-template";
    const remoteTemplateTitle = "Remote template";
    const remoteTemplateBody = "Template body";
    const remoteNote = createNote(remoteNoteId, "Remote note", "Remote body");
    const remoteTemplate = createNote(
      remoteTemplateId,
      remoteTemplateTitle,
      remoteTemplateBody
    );
    const remoteUiState = { workspaceState: { focusedPane: "secondary" } };
    const remoteSearchIndex = '{"tokens":["remote"]}';
    const remoteAsset = new Blob(["remote-asset"], { type: "image/png" });
    const seed: MockS3SeedEntry[] = [
      [
        vaultKey,
        JSON.stringify({ ...createDefaultVault(), updatedAt: Date.now() }),
      ],
      [noteJsonKey(remoteNoteId), JSON.stringify(remoteNote)],
      [templateJsonKey(remoteTemplateId), JSON.stringify(remoteTemplate)],
      [uiStateKey, JSON.stringify(remoteUiState)],
      [searchIndexKey, remoteSearchIndex],
      [assetKey("remote-asset.png"), remoteAsset],
    ];
    const { client } = createMockS3Transport(seed);
    const adapter = new S3Adapter(s3Config, { client });

    await adapter.init();

    const loadedNote = await adapter.readNote(remoteNoteId);
    const loadedTemplate = await adapter.readTemplate(remoteTemplateId);
    const loadedUiState = await adapter.readUIState();
    const loadedSearchIndex = await adapter.readSearchIndex();
    const loadedAsset = await adapter.readAsset("remote-asset.png");

    expect(loadedNote?.title).toBe("Remote note");
    expect(loadedTemplate?.title).toBe(remoteTemplateTitle);
    expect(loadedUiState).toEqual(remoteUiState);
    expect(loadedSearchIndex).toBe(remoteSearchIndex);
    expect(loadedAsset?.size).toBe(remoteAsset.size);
    expect(loadedAsset?.type).toBe(remoteAsset.type);
  });
});
describe("S3Adapter sync telemetry", () => {
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

  it("persists sync status telemetry and reconciliation outcome", async () => {
    const { client } = createMockS3Transport();
    const adapter = new S3Adapter(s3Config, { client });
    await adapter.init();

    const initStatus = await adapter.getSyncStatus();
    expect(initStatus.lastInitResolution).toBe("created_default");
    expect(initStatus.pendingCount).toBe(0);
    expect(initStatus.lastSuccessAt).toBeTypeOf("number");

    await adapter.writeNote({
      noteId: "sync-note",
      noteDocument: createNote("sync-note", "Sync note", "Body"),
      derivedMarkdown: "# Sync note\n\nBody",
    });

    const queuedStatus = await adapter.getSyncStatus();
    expect(queuedStatus.pendingCount).toBeGreaterThan(0);

    await adapter.flushNowForTests();

    const flushedStatus = await adapter.getSyncStatus();
    expect(flushedStatus.state).toBe("idle");
    expect(flushedStatus.pendingCount).toBe(0);
    expect(flushedStatus.lastSuccessAt).toBeTypeOf("number");
  });

  it("classifies auth errors and records outbox retry metadata", async () => {
    const send = vi.fn(
      // eslint-disable-next-line @typescript-eslint/require-await
      async (command: unknown) => {
        if (command instanceof PutObjectCommand) {
          throw Object.assign(new Error("Forbidden"), {
            $metadata: { httpStatusCode: 403 },
          });
        }
        if (command instanceof GetObjectCommand) {
          throw createNotFoundError();
        }
        return {};
      }
    );
    const adapter = new S3Adapter(s3Config, {
      client: { send } satisfies S3Transport,
    });

    await adapter.init();
    await adapter.writeVault(createDefaultVault());
    await adapter.flushNowForTests();

    const status = await adapter.getSyncStatus();
    expect(status.state).toBe("error");
    expect(status.lastError?.startsWith("auth:")).toBe(true);

    const outbox = await listOutboxItems(s3CacheDatabaseName);
    expect(outbox.length).toBeGreaterThan(0);
    expect(outbox[0]?.retryCount).toBeGreaterThan(0);
    expect(outbox[0]?.lastAttemptAt).toBeTypeOf("number");
    expect(outbox[0]?.lastError?.startsWith("auth:")).toBe(true);
  });

  it("classifies timeout failures from aborted requests", async () => {
    const send = vi.fn(
      // eslint-disable-next-line @typescript-eslint/require-await
      async (command: unknown) => {
        if (command instanceof GetObjectCommand) {
          throw createNotFoundError();
        }
        if (command instanceof PutObjectCommand) {
          const abortError = new Error("Aborted");
          abortError.name = "AbortError";
          throw abortError;
        }
        return {};
      }
    );
    const timeoutClient: S3Transport = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      send: send as unknown as S3Transport["send"],
    };
    const adapter = new S3Adapter(s3Config, { client: timeoutClient });

    await adapter.init();
    await adapter.writeVault(createDefaultVault());
    await adapter.flushNowForTests();

    const status = await adapter.getSyncStatus();
    expect(status.lastError?.startsWith("timeout:")).toBe(true);
  });
});
