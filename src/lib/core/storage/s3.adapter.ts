/* eslint-disable sonarjs/arrow-function-convention */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { toDerivedMarkdown } from "../utils/derived-markdown";
import { IndexedDBAdapter, createDefaultVault } from "./indexeddb.adapter";
import { deleteOutboxItem, listOutboxItems, putOutboxItem } from "./s3/outbox";
import type { SyncOutboxItem, SyncOutboxKind } from "./s3/outbox";
import type {
  AssetMeta,
  NoteDocumentFile,
  NoteIndexEntry,
  S3Config,
  StorageAdapter,
  TemplateIndexEntry,
  UIState,
  Vault,
} from "./types";

export type S3Transport = {
  send: S3Client["send"];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const sortOutboxItems = (items: SyncOutboxItem[]): SyncOutboxItem[] => {
  const priority: Record<SyncOutboxKind, number> = {
    note: 1,
    template: 2,
    asset: 3,
    deleteNotePermanent: 4,
    deleteTemplate: 5,
    uiState: 6,
    searchIndex: 7,
    vault: 8,
  };
  return items.toSorted((first, second) => {
    const firstPriority = priority[first.kind];
    const secondPriority = priority[second.kind];
    if (firstPriority !== secondPriority) {
      return firstPriority - secondPriority;
    }
    return first.queuedAt - second.queuedAt;
  });
};

type BrowserWindow = Pick<
  Window,
  | "setInterval"
  | "clearInterval"
  | "setTimeout"
  | "clearTimeout"
  | "addEventListener"
>;

const isBrowserWindow = (value: unknown): value is BrowserWindow => {
  if (!isRecord(value)) {
    return false;
  }
  const checks = [
    typeof value.setInterval === "function",
    typeof value.clearInterval === "function",
    typeof value.setTimeout === "function",
    typeof value.clearTimeout === "function",
    typeof value.addEventListener === "function",
  ];
  return checks.every(Boolean);
};

const getBrowserWindow = (): BrowserWindow | null => {
  const candidate = Reflect.get(globalThis, "window");
  return isBrowserWindow(candidate) ? candidate : null;
};

type ParsedListObjects = {
  assetIds: string[];
  isTruncated: boolean;
  nextContinuationToken: string | null;
};

const parseListObjectsForAssetIds = (
  response: unknown,
  assetPrefix: string
): ParsedListObjects => {
  if (!isRecord(response)) {
    return { assetIds: [], isTruncated: false, nextContinuationToken: null };
  }

  const contents = Array.isArray(response.Contents) ? response.Contents : [];
  const assetIds = contents
    .map((entry) =>
      isRecord(entry) && typeof entry.Key === "string" ? entry.Key : null
    )
    .filter((key): key is string => typeof key === "string")
    .filter((key) => key.startsWith(assetPrefix))
    .map((key) => key.slice(assetPrefix.length))
    .filter((assetId) => assetId.length > 0);

  return {
    assetIds,
    isTruncated: response.IsTruncated === true,
    nextContinuationToken:
      typeof response.NextContinuationToken === "string"
        ? response.NextContinuationToken
        : null,
  };
};

const normalizePrefix = (prefix?: string): string => {
  const raw = (prefix ?? "embervault/").trim();
  const stripped = raw.replace(/^\/+/u, "");
  if (stripped.length === 0) {
    return "embervault/";
  }
  return stripped.endsWith("/") ? stripped : `${stripped}/`;
};

const isNotFoundError = (error: unknown): boolean => {
  if (!isRecord(error)) {
    return false;
  }
  const metadata = error.$metadata;
  return (
    isRecord(metadata) &&
    typeof metadata.httpStatusCode === "number" &&
    metadata.httpStatusCode === 404
  );
};

const isBodyInit = (value: unknown): value is BodyInit => {
  if (typeof value === "string") {
    return true;
  }
  if (value instanceof Blob) {
    return true;
  }
  if (value instanceof ArrayBuffer) {
    return true;
  }
  if (value instanceof Uint8Array) {
    return true;
  }
  if (
    typeof ReadableStream !== "undefined" &&
    value instanceof ReadableStream
  ) {
    return true;
  }
  return false;
};

const readBodyAsText = async (body: unknown): Promise<string> => {
  if (typeof body === "string") {
    return body;
  }
  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body);
  }
  if (body instanceof Blob) {
    return body.text();
  }
  if (isBodyInit(body) && typeof Response !== "undefined") {
    return new Response(body).text();
  }
  throw new Error("Unsupported S3 response body.");
};

const readBodyAsBlob = async (body: unknown): Promise<Blob> => {
  if (body instanceof Blob) {
    return body;
  }
  if (isBodyInit(body) && typeof Response !== "undefined") {
    return new Response(body).blob();
  }
  throw new Error("Unsupported S3 response body.");
};

type S3Keys = {
  vault: string;
  uiState: string;
  searchIndex: string;
  noteJson: (noteId: string) => string;
  noteMd: (noteId: string) => string;
  templateJson: (templateId: string) => string;
  templateMd: (templateId: string) => string;
  asset: (assetId: string) => string;
};

const buildKeys = (prefix: string): S3Keys => ({
  vault: `${prefix}vault.json`,
  uiState: `${prefix}ui-state.json`,
  searchIndex: `${prefix}search-index.json`,
  noteJson: (noteId) => `${prefix}notes/${noteId}.json`,
  noteMd: (noteId) => `${prefix}notes/${noteId}.md`,
  templateJson: (templateId) => `${prefix}templates/${templateId}.json`,
  templateMd: (templateId) => `${prefix}templates/${templateId}.md`,
  asset: (assetId) => `${prefix}assets/${assetId}`,
});

type InitOptions = {
  client?: S3Transport;
};

export class S3Adapter implements StorageAdapter {
  private readonly config: S3Config;
  private readonly prefix: string;
  private readonly keys: S3Keys;
  private readonly client: S3Transport;
  private readonly cacheAdapter: IndexedDBAdapter;

  private flushInFlight = false;
  private flushTimer: number | null = null;
  private flushTimeout: number | null = null;

  public constructor(config: S3Config, options: InitOptions = {}) {
    this.config = config;
    this.prefix = normalizePrefix(config.prefix);
    this.keys = buildKeys(this.prefix);
    this.cacheAdapter = new IndexedDBAdapter();
    this.client =
      options.client ??
      new S3Client({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
          sessionToken: config.sessionToken,
        },
      });
  }

  public async init(): Promise<void> {
    await this.cacheAdapter.init();

    const remoteVault = await this.readRemoteJson<Vault>(this.keys.vault);
    const localVault = await this.cacheAdapter.readVault();

    if (remoteVault) {
      const useRemoteVault =
        !localVault || remoteVault.updatedAt >= localVault.updatedAt;
      await (useRemoteVault
        ? this.cacheAdapter.writeVault(remoteVault)
        : putOutboxItem({ key: "vault", kind: "vault" }));
    } else if (localVault) {
      await putOutboxItem({ key: "vault", kind: "vault" });
    } else {
      const vault = createDefaultVault();
      await this.cacheAdapter.writeVault(vault);
      await putOutboxItem({ key: "vault", kind: "vault" });
    }

    // Kick off an early flush, then keep flushing periodically.
    await this.flushOutbox();
    this.startFlushLoop();
  }

  public async flushNowForTests(): Promise<void> {
    if (import.meta.env.MODE !== "test") {
      throw new Error("S3Adapter.flushNowForTests is only available in tests.");
    }
    await this.flushOutbox();
  }

  public async readVault(): Promise<Vault | null> {
    const local = await this.cacheAdapter.readVault();
    if (local) {
      return local;
    }
    const remote = await this.readRemoteJson<Vault>(this.keys.vault);
    if (remote) {
      await this.cacheAdapter.writeVault(remote);
      return remote;
    }
    return null;
  }

  public async writeVault(vault: Vault): Promise<void> {
    await this.cacheAdapter.writeVault(vault);
    await putOutboxItem({ key: "vault", kind: "vault" });
    this.scheduleFlush();
  }

  public async listNotes(): Promise<NoteIndexEntry[]> {
    return this.cacheAdapter.listNotes();
  }

  public async listTemplates(): Promise<TemplateIndexEntry[]> {
    return this.cacheAdapter.listTemplates();
  }

  public async readNote(noteId: string): Promise<NoteDocumentFile | null> {
    const local = await this.cacheAdapter.readNote(noteId);
    if (local) {
      return local;
    }
    const remote = await this.readRemoteJson<NoteDocumentFile>(
      this.keys.noteJson(noteId)
    );
    if (!remote) {
      return null;
    }
    await this.cacheAdapter.writeNote({
      noteId,
      noteDocument: remote,
      derivedMarkdown: toDerivedMarkdown(
        remote.title,
        remote.derived?.plainText ?? ""
      ),
    });
    return remote;
  }

  public async readTemplate(
    templateId: string
  ): Promise<NoteDocumentFile | null> {
    const local = await this.cacheAdapter.readTemplate(templateId);
    if (local) {
      return local;
    }
    const remote = await this.readRemoteJson<NoteDocumentFile>(
      this.keys.templateJson(templateId)
    );
    if (!remote) {
      return null;
    }
    await this.cacheAdapter.writeTemplate({
      templateId,
      noteDocument: remote,
      derivedMarkdown: toDerivedMarkdown(
        remote.title,
        remote.derived?.plainText ?? ""
      ),
    });
    return remote;
  }

  public async writeNote(input: {
    noteId: string;
    noteDocument: NoteDocumentFile;
    derivedMarkdown: string;
  }): Promise<void> {
    await this.cacheAdapter.writeNote(input);
    await putOutboxItem({
      key: `note:${input.noteId}`,
      kind: "note",
      id: input.noteId,
    });
    await putOutboxItem({ key: "vault", kind: "vault" });
    this.scheduleFlush();
  }

  public async writeTemplate(input: {
    templateId: string;
    noteDocument: NoteDocumentFile;
    derivedMarkdown: string;
  }): Promise<void> {
    await this.cacheAdapter.writeTemplate(input);
    await putOutboxItem({
      key: `template:${input.templateId}`,
      kind: "template",
      id: input.templateId,
    });
    await putOutboxItem({ key: "vault", kind: "vault" });
    this.scheduleFlush();
  }

  public async deleteNoteSoft(noteId: string): Promise<void> {
    await this.cacheAdapter.deleteNoteSoft(noteId);
    await putOutboxItem({ key: `note:${noteId}`, kind: "note", id: noteId });
    await putOutboxItem({ key: "vault", kind: "vault" });
    this.scheduleFlush();
  }

  public async restoreNote(noteId: string): Promise<void> {
    await this.cacheAdapter.restoreNote(noteId);
    await putOutboxItem({ key: `note:${noteId}`, kind: "note", id: noteId });
    await putOutboxItem({ key: "vault", kind: "vault" });
    this.scheduleFlush();
  }

  public async deleteNotePermanent(noteId: string): Promise<void> {
    await this.cacheAdapter.deleteNotePermanent(noteId);
    await putOutboxItem({
      key: `deleteNotePermanent:${noteId}`,
      kind: "deleteNotePermanent",
      id: noteId,
    });
    await putOutboxItem({ key: "vault", kind: "vault" });
    this.scheduleFlush();
  }

  public async deleteTemplate(templateId: string): Promise<void> {
    await this.cacheAdapter.deleteTemplate(templateId);
    await putOutboxItem({
      key: `deleteTemplate:${templateId}`,
      kind: "deleteTemplate",
      id: templateId,
    });
    await putOutboxItem({ key: "vault", kind: "vault" });
    this.scheduleFlush();
  }

  public async writeAsset(input: {
    assetId: string;
    blob: Blob;
    meta?: AssetMeta;
  }): Promise<void> {
    await this.cacheAdapter.writeAsset(input);
    await putOutboxItem({
      key: `asset:${input.assetId}`,
      kind: "asset",
      id: input.assetId,
    });
    this.scheduleFlush();
  }

  public async readAsset(assetId: string): Promise<Blob | null> {
    const local = await this.cacheAdapter.readAsset(assetId);
    if (local) {
      return local;
    }
    const blob = await this.readRemoteBlob(this.keys.asset(assetId));
    if (!blob) {
      return null;
    }
    await this.cacheAdapter.writeAsset({
      assetId,
      blob,
      meta: { mime: blob.type, size: blob.size },
    });
    return blob;
  }

  public async listAssets(): Promise<string[]> {
    const local = await this.cacheAdapter.listAssets();
    try {
      const remote = await this.listRemoteAssetIds();
      const merged = new Set<string>([...local, ...remote]);
      return [...merged];
    } catch {
      return local;
    }
  }

  public async deleteAsset(assetId: string): Promise<void> {
    await this.cacheAdapter.deleteAsset(assetId);
    await putOutboxItem({
      key: `asset:${assetId}`,
      kind: "asset",
      id: assetId,
    });
    this.scheduleFlush();
  }

  public async writeUIState(state: UIState): Promise<void> {
    await this.cacheAdapter.writeUIState(state);
    await putOutboxItem({ key: "uiState", kind: "uiState" });
    this.scheduleFlush();
  }

  public async readUIState(): Promise<UIState | null> {
    const local = await this.cacheAdapter.readUIState();
    if (local) {
      return local;
    }
    const remote = await this.readRemoteJson<UIState>(this.keys.uiState);
    if (remote) {
      await this.cacheAdapter.writeUIState(remote);
      return remote;
    }
    return null;
  }

  public async writeSearchIndex(snapshot: string): Promise<void> {
    await this.cacheAdapter.writeSearchIndex(snapshot);
    await putOutboxItem({ key: "searchIndex", kind: "searchIndex" });
    this.scheduleFlush();
  }

  public async readSearchIndex(): Promise<string | null> {
    const local = await this.cacheAdapter.readSearchIndex();
    if (local) {
      return local;
    }
    const remote = await this.readRemoteText(this.keys.searchIndex);
    if (remote) {
      await this.cacheAdapter.writeSearchIndex(remote);
      return remote;
    }
    return null;
  }

  private startFlushLoop(): void {
    if (import.meta.env.MODE === "test") {
      return;
    }
    const win = getBrowserWindow();
    if (!win) {
      return;
    }
    if (this.flushTimer !== null) {
      return;
    }
    this.flushTimer = win.setInterval(() => {
      // eslint-disable-next-line no-void
      void this.flushOutbox();
    }, 2500);
    win.addEventListener("online", () => {
      // eslint-disable-next-line no-void
      void this.flushOutbox();
    });
  }

  private scheduleFlush(): void {
    const win = getBrowserWindow();
    if (!win) {
      return;
    }
    if (this.flushTimeout !== null) {
      win.clearTimeout(this.flushTimeout);
    }
    this.flushTimeout = win.setTimeout(() => {
      // eslint-disable-next-line no-void
      void this.flushOutbox();
    }, 800);
  }

  private async flushOutbox(): Promise<void> {
    if (this.flushInFlight) {
      return;
    }
    this.flushInFlight = true;
    try {
      const items = await listOutboxItems();
      const ordered = sortOutboxItems(items);
      for (const item of ordered) {
        // eslint-disable-next-line no-await-in-loop
        await this.flushOutboxItem(item);
        // eslint-disable-next-line no-await-in-loop
        await deleteOutboxItem(item.key);
      }
    } catch {
      // Keep queued items for retry.
    } finally {
      this.flushInFlight = false;
    }
  }

  private async flushOutboxItem(item: SyncOutboxItem): Promise<void> {
    switch (item.kind) {
      case "vault": {
        await this.flushVaultItem();
        break;
      }
      case "note": {
        await this.flushNoteItem(item.id);
        break;
      }
      case "template": {
        await this.flushTemplateItem(item.id);
        break;
      }
      case "asset": {
        await this.flushAssetItem(item.id);
        break;
      }
      case "uiState": {
        await this.flushUiStateItem();
        break;
      }
      case "searchIndex": {
        await this.flushSearchIndexItem();
        break;
      }
      case "deleteNotePermanent": {
        await this.flushDeleteNoteItem(item.id);
        break;
      }
      case "deleteTemplate": {
        await this.flushDeleteTemplateItem(item.id);
        break;
      }
      default: {
        break;
      }
    }
  }

  private async flushVaultItem(): Promise<void> {
    const vault = await this.cacheAdapter.readVault();
    if (!vault) {
      return;
    }
    await this.putJson(this.keys.vault, vault);
  }

  private async flushNoteItem(noteId?: string): Promise<void> {
    if (!noteId) {
      return;
    }
    const note = await this.cacheAdapter.readNote(noteId);
    if (!note) {
      await this.deleteObjectIfExists(this.keys.noteJson(noteId));
      await this.deleteObjectIfExists(this.keys.noteMd(noteId));
      return;
    }
    await this.putJson(this.keys.noteJson(noteId), note);
    const markdown = toDerivedMarkdown(
      note.title,
      note.derived?.plainText ?? ""
    );
    await this.putText(this.keys.noteMd(noteId), markdown, "text/markdown");
  }

  private async flushTemplateItem(templateId?: string): Promise<void> {
    if (!templateId) {
      return;
    }
    const template = await this.cacheAdapter.readTemplate(templateId);
    if (!template) {
      await this.deleteObjectIfExists(this.keys.templateJson(templateId));
      await this.deleteObjectIfExists(this.keys.templateMd(templateId));
      return;
    }
    await this.putJson(this.keys.templateJson(templateId), template);
    const markdown = toDerivedMarkdown(
      template.title,
      template.derived?.plainText ?? ""
    );
    await this.putText(
      this.keys.templateMd(templateId),
      markdown,
      "text/markdown"
    );
  }

  private async flushAssetItem(assetId?: string): Promise<void> {
    if (!assetId) {
      return;
    }
    const blob = await this.cacheAdapter.readAsset(assetId);
    if (!blob) {
      await this.deleteObjectIfExists(this.keys.asset(assetId));
      return;
    }
    await this.putBlob(this.keys.asset(assetId), blob);
  }

  private async flushUiStateItem(): Promise<void> {
    const state = await this.cacheAdapter.readUIState();
    if (!state) {
      return;
    }
    await this.putJson(this.keys.uiState, state);
  }

  private async flushSearchIndexItem(): Promise<void> {
    const snapshot = await this.cacheAdapter.readSearchIndex();
    if (!snapshot) {
      return;
    }
    await this.putText(this.keys.searchIndex, snapshot, "application/json");
  }

  private async flushDeleteNoteItem(noteId?: string): Promise<void> {
    if (!noteId) {
      return;
    }
    await this.deleteObjectIfExists(this.keys.noteJson(noteId));
    await this.deleteObjectIfExists(this.keys.noteMd(noteId));
  }

  private async flushDeleteTemplateItem(templateId?: string): Promise<void> {
    if (!templateId) {
      return;
    }
    await this.deleteObjectIfExists(this.keys.templateJson(templateId));
    await this.deleteObjectIfExists(this.keys.templateMd(templateId));
  }

  private async listRemoteAssetIds(): Promise<string[]> {
    const assetPrefix = this.keys.asset("");
    const ids = new Set<string>();
    const maxPages = 50;
    let page = 0;
    let continuationToken: string | null = null;
    let done = false;

    while (!done && page < maxPages) {
      // eslint-disable-next-line no-await-in-loop
      const response: unknown = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: assetPrefix,
          ContinuationToken: continuationToken ?? undefined,
          MaxKeys: 1000,
        })
      );

      const parsed = parseListObjectsForAssetIds(response, assetPrefix);
      for (const assetId of parsed.assetIds) {
        ids.add(assetId);
      }

      continuationToken = parsed.nextContinuationToken;
      done = !parsed.isTruncated || !continuationToken;
      page += 1;
    }

    return [...ids];
  }

  private async readRemoteText(key: string): Promise<string | null> {
    try {
      const response: unknown = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key })
      );
      const body = isRecord(response) ? response.Body : undefined;
      if (!body) {
        return null;
      }
      return await readBodyAsText(body);
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  private async readRemoteJson<T>(key: string): Promise<T | null> {
    const text = await this.readRemoteText(key);
    if (text === null) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return JSON.parse(text) as T;
  }

  private async readRemoteBlob(key: string): Promise<Blob | null> {
    try {
      const response: unknown = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key })
      );
      const body = isRecord(response) ? response.Body : undefined;
      if (!body) {
        return null;
      }
      return await readBodyAsBlob(body);
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  private async putJson(key: string, value: unknown): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: JSON.stringify(value),
        ContentType: "application/json",
      })
    );
  }

  private async putText(
    key: string,
    value: string,
    contentType: string
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: value,
        ContentType: `${contentType}; charset=utf-8`,
      })
    );
  }

  private async putBlob(key: string, blob: Blob): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: blob,
        ContentType: blob.type || undefined,
      })
    );
  }

  private async deleteObjectIfExists(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key })
      );
    } catch (error) {
      if (isNotFoundError(error)) {
        return;
      }
      throw error;
    }
  }
}
