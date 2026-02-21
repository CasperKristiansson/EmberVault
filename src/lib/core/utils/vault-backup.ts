import { toDerivedMarkdown } from "$lib/core/utils/derived-markdown";
import type {
  NoteDocumentFile,
  StorageAdapter,
  Vault,
} from "$lib/core/storage/types";

const backupFormat = "embervault-backup" as const;
const jsonMimeType = "application/json";
const gzipMimeType = "application/gzip";
const fallbackAssetMimeType = "application/octet-stream";

type BackupNoteEntry = {
  noteId: string;
  noteDocument: NoteDocumentFile;
  derivedMarkdown: string;
};

type BackupAssetEntry = {
  assetId: string;
  mime: string;
  dataBase64: string;
};

export type VaultBackupV1 = {
  format: "embervault-backup";
  version: 1;
  createdAt: number;
  vault: Vault;
  notes: BackupNoteEntry[];
  assets: BackupAssetEntry[];
};

const hasCompressionStreams = (): boolean =>
  typeof CompressionStream !== "undefined" &&
  typeof DecompressionStream !== "undefined";

const readBlobAsArrayBuffer = async (blob: Blob): Promise<ArrayBuffer> => {
  const candidate = blob as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof candidate.arrayBuffer === "function") {
    return candidate.arrayBuffer();
  }

  if (typeof FileReader === "undefined") {
    const streamCandidate = blob as Blob & {
      stream?: () => ReadableStream<Uint8Array>;
    };
    if (typeof streamCandidate.stream === "function") {
      return new Response(streamCandidate.stream()).arrayBuffer();
    }
    throw new Error("Blob reading is not supported in this environment.");
  }

  // eslint-disable-next-line compat/compat, promise/avoid-new -- Promise-based FileReader fallback for non-standard Blob implementations.
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("Read failed."))
    );
    reader.addEventListener("load", () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error("Read failed."));
    });
    // eslint-disable-next-line unicorn/prefer-blob-reading-methods -- Fallback for environments without Blob#arrayBuffer.
    reader.readAsArrayBuffer(blob);
  });
};

const readBlobAsText = async (blob: Blob): Promise<string> => {
  const candidate = blob as Blob & { text?: () => Promise<string> };
  if (typeof candidate.text === "function") {
    return candidate.text();
  }
  const buffer = await readBlobAsArrayBuffer(blob);
  return new TextDecoder().decode(buffer);
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  // Chunk to avoid call stack and argument limits.
  const chunkSize = 0x80_00;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCodePoint(...chunk);
  }
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index) ?? 0;
  }
  return bytes;
};

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const buffer = await readBlobAsArrayBuffer(blob);
  return bytesToBase64(new Uint8Array(buffer));
};

const gzipBlobIfSupported = async (blob: Blob): Promise<Blob> => {
  if (!hasCompressionStreams()) {
    return blob;
  }

  const stream = blob.stream().pipeThrough(new CompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Blob([buffer], { type: gzipMimeType });
};

const looksLikeGzip = async (blob: Blob): Promise<boolean> => {
  if (blob.type === gzipMimeType) {
    return true;
  }
  const header = await readBlobAsArrayBuffer(blob.slice(0, 2));
  const bytes = new Uint8Array(header);
  const gzipMagicByte0 = 31;
  const gzipMagicByte1 = 139;
  return (
    bytes.length >= 2 &&
    bytes[0] === gzipMagicByte0 &&
    bytes[1] === gzipMagicByte1
  );
};

const gunzipBlobIfNeeded = async (blob: Blob): Promise<Blob> => {
  if (!hasCompressionStreams()) {
    return blob;
  }
  if (!(await looksLikeGzip(blob))) {
    return blob;
  }

  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Blob([buffer], { type: jsonMimeType });
};

const pathSegmentSeparator = "\u001F";
const noteConflictSeparator = "\u001E";
const maxFolderTraversalDepth = 64;

const normalizeComparisonToken = (value: string): string =>
  value.trim().toLowerCase();

const toFolderPathKey = (segments: string[]): string =>
  segments.map(normalizeComparisonToken).join(pathSegmentSeparator);

const toFolderLookupKey = (
  parentId: string | null,
  folderName: string
): string =>
  `${parentId ?? "__root__"}${noteConflictSeparator}${normalizeComparisonToken(folderName)}`;

const toNoteConflictKey = (
  title: string,
  folderPathSegments: string[],
  fallbackId: string
): string => {
  const normalizedTitle = normalizeComparisonToken(title);
  return `${toFolderPathKey(folderPathSegments)}${noteConflictSeparator}${
    normalizedTitle.length > 0 ? normalizedTitle : fallbackId
  }`;
};

const deepCloneFolders = (folders: Vault["folders"]): Vault["folders"] =>
  Object.fromEntries(
    Object.entries(folders).map(([id, folder]) => [
      id,
      {
        ...folder,
        childFolderIds: [...folder.childFolderIds],
      },
    ])
  );

const rebuildFolderChildren = (folders: Vault["folders"]): Vault["folders"] => {
  const next = Object.fromEntries(
    Object.entries(folders).map(([id, folder]) => [
      id,
      {
        ...folder,
        childFolderIds: [],
      },
    ])
  ) as Vault["folders"];

  for (const folder of Object.values(next)) {
    if (folder.parentId) {
      const parent = next[folder.parentId];
      parent.childFolderIds.push(folder.id);
    }
  }

  return next;
};

/* eslint-disable sonarjs/too-many-break-or-continue-in-loop */
const resolveFolderPathById = (
  folders: Record<
    string,
    {
      name: string;
      parentId: string | null;
    }
  >,
  folderId: string | null
): string[] => {
  if (!folderId) {
    return [];
  }
  const folderById = new Map<string, { name: string; parentId: string | null }>(
    Object.entries(folders) as [
      string,
      {
        name: string;
        parentId: string | null;
      },
    ][]
  );
  const path: string[] = [];
  const seen = new Set<string>();
  let currentId: string | null = folderId;
  for (
    let depth = 0;
    depth < maxFolderTraversalDepth && currentId !== null;
    depth += 1
  ) {
    const resolvedId = currentId;
    if (seen.has(resolvedId)) {
      break;
    }
    seen.add(resolvedId);
    const folder = folderById.get(resolvedId);
    if (!folder) {
      break;
    }
    path.push(folder.name);
    currentId = folder.parentId;
  }
  return path.toReversed();
};
/* eslint-enable sonarjs/too-many-break-or-continue-in-loop */

const createUniqueIdentifier = (
  desiredId: string,
  existingIds: Set<string>
): string => {
  if (!existingIds.has(desiredId)) {
    return desiredId;
  }
  let suffix = 1;
  while (existingIds.has(`${desiredId}-merged-${suffix}`)) {
    suffix += 1;
  }
  return `${desiredId}-merged-${suffix}`;
};

export const createVaultBackup = async (input: {
  adapter: StorageAdapter;
  vault: Vault;
  now?: Date;
}): Promise<VaultBackupV1> => {
  const now = input.now ?? new Date();
  const noteIds = Object.keys(input.vault.notesIndex);
  const notes: BackupNoteEntry[] = [];
  for (const noteId of noteIds) {
    // eslint-disable-next-line no-await-in-loop
    const note = await input.adapter.readNote(noteId);
    if (note) {
      const derivedMarkdown = toDerivedMarkdown(
        note.title,
        note.derived?.plainText ?? ""
      );
      notes.push({
        noteDocument: note,
        derivedMarkdown,
        noteId,
      });
    }
  }

  const assetIds = await input.adapter.listAssets();
  const assets: BackupAssetEntry[] = [];
  for (const assetId of assetIds) {
    // eslint-disable-next-line no-await-in-loop
    const blob = await input.adapter.readAsset(assetId);
    if (blob) {
      // mime may be empty in some adapters for unknown assets.
      const mime = blob.type || fallbackAssetMimeType;
      // eslint-disable-next-line no-await-in-loop
      const dataBase64 = await blobToBase64(blob);
      assets.push({ assetId, mime, dataBase64 });
    }
  }

  return {
    format: backupFormat,
    version: 1,
    createdAt: now.getTime(),
    vault: input.vault,
    notes,
    assets,
  };
};

/* eslint-disable sonarjs/cognitive-complexity, sonarjs/cyclomatic-complexity, unicorn/no-array-sort, sonarjs/too-many-break-or-continue-in-loop, no-continue, unicorn/prefer-at, sonarjs/shorthand-property-grouping, sonarjs/arrow-function-convention */
export const mergeVaultBackups = (input: {
  base: VaultBackupV1;
  incoming: VaultBackupV1;
}): VaultBackupV1 => {
  const { base, incoming } = input;
  let mergedFolders = deepCloneFolders(base.vault.folders);

  const baseFolderPathById = Object.fromEntries(
    Object.keys(base.vault.folders).map((folderId) => [
      folderId,
      resolveFolderPathById(base.vault.folders, folderId),
    ])
  ) as Record<string, string[]>;
  const incomingFolderPathById = Object.fromEntries(
    Object.keys(incoming.vault.folders).map((folderId) => [
      folderId,
      resolveFolderPathById(incoming.vault.folders, folderId),
    ])
  ) as Record<string, string[]>;

  const folderIds = new Set(Object.keys(mergedFolders));
  const mergedFolderIdByPath = new Map<string, string>();
  for (const folderId of Object.keys(mergedFolders)) {
    const pathKey = toFolderPathKey(
      resolveFolderPathById(mergedFolders, folderId)
    );
    if (pathKey.length > 0) {
      mergedFolderIdByPath.set(pathKey, folderId);
    }
  }

  const existingFolderByParentAndName = new Map<string, string>();
  for (const folder of Object.values(mergedFolders)) {
    existingFolderByParentAndName.set(
      toFolderLookupKey(folder.parentId, folder.name),
      folder.id
    );
  }

  const incomingToMergedFolderId = new Map<string, string>();
  for (const folderId of Object.keys(mergedFolders)) {
    incomingToMergedFolderId.set(folderId, folderId);
  }

  const incomingFolderIdsByDepth = Object.entries(incomingFolderPathById)
    .sort((first, second) => first[1].length - second[1].length)
    .map(([folderId]) => folderId);

  for (const incomingFolderId of incomingFolderIdsByDepth) {
    const path = incomingFolderPathById[incomingFolderId] ?? [];
    if (path.length === 0) {
      continue;
    }
    const pathKey = toFolderPathKey(path);
    const existingByPath = mergedFolderIdByPath.get(pathKey);
    if (existingByPath) {
      incomingToMergedFolderId.set(incomingFolderId, existingByPath);
      continue;
    }

    const parentPath = path.slice(0, -1);
    const folderName = path[path.length - 1] ?? "";
    const parentPathKey = toFolderPathKey(parentPath);
    const parentId =
      parentPath.length > 0
        ? (mergedFolderIdByPath.get(parentPathKey) ?? null)
        : null;
    const existingByName = existingFolderByParentAndName.get(
      toFolderLookupKey(parentId, folderName)
    );
    if (existingByName) {
      incomingToMergedFolderId.set(incomingFolderId, existingByName);
      mergedFolderIdByPath.set(pathKey, existingByName);
      continue;
    }

    const nextFolderId = createUniqueIdentifier(incomingFolderId, folderIds);
    folderIds.add(nextFolderId);
    mergedFolders = {
      ...mergedFolders,
      [nextFolderId]: {
        id: nextFolderId,
        name: folderName,
        parentId,
        childFolderIds: [],
      },
    };
    existingFolderByParentAndName.set(
      toFolderLookupKey(parentId, folderName),
      nextFolderId
    );
    mergedFolderIdByPath.set(pathKey, nextFolderId);
    incomingToMergedFolderId.set(incomingFolderId, nextFolderId);
  }

  mergedFolders = rebuildFolderChildren(mergedFolders);

  const mergedFolderPathById = Object.fromEntries(
    Object.keys(mergedFolders).map((folderId) => [
      folderId,
      resolveFolderPathById(mergedFolders, folderId),
    ])
  ) as Record<string, string[]>;

  const noteEntriesById = new Map<string, BackupNoteEntry>();
  const conflictKeyToNoteId = new Map<string, string>();

  const upsertMergedNote = (
    entry: BackupNoteEntry,
    folderIdResolver: (folderId: string | null) => string | null,
    preferIncoming = false
  ): void => {
    const resolvedFolderId = folderIdResolver(entry.noteDocument.folderId);
    const conflictKey = toNoteConflictKey(
      entry.noteDocument.title,
      resolvedFolderId ? (mergedFolderPathById[resolvedFolderId] ?? []) : [],
      entry.noteId
    );
    const existingNoteId = conflictKeyToNoteId.get(conflictKey);

    if (preferIncoming && existingNoteId) {
      noteEntriesById.set(existingNoteId, {
        ...entry,
        noteId: existingNoteId,
        noteDocument: {
          ...entry.noteDocument,
          id: existingNoteId,
          folderId: resolvedFolderId,
        },
      });
      return;
    }

    const desiredId = existingNoteId ?? entry.noteId;
    const nextId =
      existingNoteId ??
      createUniqueIdentifier(desiredId, new Set(noteEntriesById.keys()));

    noteEntriesById.set(nextId, {
      ...entry,
      noteId: nextId,
      noteDocument: {
        ...entry.noteDocument,
        id: nextId,
        folderId: resolvedFolderId,
      },
    });
    conflictKeyToNoteId.set(conflictKey, nextId);
  };

  const resolveBaseFolderId = (folderId: string | null): string | null => {
    if (!folderId) {
      return null;
    }
    const path = baseFolderPathById[folderId] ?? [];
    return mergedFolderIdByPath.get(toFolderPathKey(path)) ?? null;
  };

  const resolveIncomingFolderId = (folderId: string | null): string | null => {
    if (!folderId) {
      return null;
    }
    const mapped = incomingToMergedFolderId.get(folderId);
    if (mapped) {
      return mapped;
    }
    const path = incomingFolderPathById[folderId] ?? [];
    return mergedFolderIdByPath.get(toFolderPathKey(path)) ?? null;
  };

  for (const entry of base.notes) {
    upsertMergedNote(entry, resolveBaseFolderId);
  }
  for (const entry of incoming.notes) {
    upsertMergedNote(entry, resolveIncomingFolderId, true);
  }

  const mergedAssetsById = new Map<string, BackupAssetEntry>();
  for (const asset of base.assets) {
    mergedAssetsById.set(asset.assetId, asset);
  }
  for (const asset of incoming.assets) {
    mergedAssetsById.set(asset.assetId, asset);
  }

  return {
    format: backupFormat,
    version: 1,
    createdAt: Math.max(base.createdAt, incoming.createdAt),
    vault: {
      id: base.vault.id || incoming.vault.id,
      name: incoming.vault.name || base.vault.name,
      createdAt: Math.min(base.vault.createdAt, incoming.vault.createdAt),
      updatedAt: Math.max(base.vault.updatedAt, incoming.vault.updatedAt),
      folders: mergedFolders,
      tags: {
        ...base.vault.tags,
        ...incoming.vault.tags,
      },
      notesIndex: {},
      templatesIndex: {},
      settings: {
        ...base.vault.settings,
        ...incoming.vault.settings,
      },
    },
    notes: [...noteEntriesById.values()],
    assets: [...mergedAssetsById.values()],
  };
};
/* eslint-enable sonarjs/cognitive-complexity, sonarjs/cyclomatic-complexity, unicorn/no-array-sort, sonarjs/too-many-break-or-continue-in-loop, no-continue, unicorn/prefer-at, sonarjs/shorthand-property-grouping, sonarjs/arrow-function-convention */

export const serializeVaultBackup = async (input: {
  backup: VaultBackupV1;
  compress?: boolean;
}): Promise<{ blob: Blob; fileName: string }> => {
  const payload = JSON.stringify(input.backup);
  const jsonBlob = new Blob([payload], { type: jsonMimeType });
  const compress = input.compress !== false;
  const blob = compress ? await gzipBlobIfSupported(jsonBlob) : jsonBlob;
  const extension = blob.type === gzipMimeType ? "json.gz" : "json";
  return {
    blob,
    fileName: `embervault-backup-${input.backup.createdAt}.${extension}`,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isBackupNoteEntry = (value: unknown): value is BackupNoteEntry => {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.noteId !== "string") {
    return false;
  }
  if (!isRecord(value.noteDocument)) {
    return false;
  }
  return typeof value.derivedMarkdown === "string";
};

const isBackupAssetEntry = (value: unknown): value is BackupAssetEntry => {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.assetId !== "string") {
    return false;
  }
  if (typeof value.mime !== "string") {
    return false;
  }
  return typeof value.dataBase64 === "string";
};

const isVaultBackupV1 = (value: unknown): value is VaultBackupV1 => {
  if (!isRecord(value)) {
    return false;
  }
  if (value.format !== backupFormat) {
    return false;
  }
  if (value.version !== 1) {
    return false;
  }
  if (typeof value.createdAt !== "number") {
    return false;
  }
  if (!isRecord(value.vault)) {
    return false;
  }
  if (!Array.isArray(value.notes) || !value.notes.every(isBackupNoteEntry)) {
    return false;
  }
  return Array.isArray(value.assets) && value.assets.every(isBackupAssetEntry);
};

export const parseVaultBackup = async (input: {
  file: File | Blob;
}): Promise<VaultBackupV1> => {
  const maybeJson = await gunzipBlobIfNeeded(input.file);
  const text = await readBlobAsText(maybeJson);
  const parsed: unknown = JSON.parse(text);
  if (!isVaultBackupV1(parsed)) {
    throw new Error("Unsupported backup file.");
  }
  return parsed;
};

export const restoreVaultBackup = async (input: {
  adapter: StorageAdapter;
  backup: VaultBackupV1;
  onProgress?: (value: {
    phase: string;
    current: number;
    total: number;
  }) => void;
}): Promise<void> => {
  const progress = input.onProgress ?? (() => "");
  const { adapter, backup } = input;
  const { assets, notes, vault } = backup;

  // Best-effort wipe of existing content to avoid mixing vaults.
  const existingVault = await adapter.readVault();
  if (existingVault) {
    const noteIds = Object.keys(existingVault.notesIndex);
    progress({ phase: "delete-notes", current: 0, total: noteIds.length });
    for (const [index, noteId] of noteIds.entries()) {
      // eslint-disable-next-line no-await-in-loop
      await adapter.deleteNotePermanent(noteId);
      progress({
        phase: "delete-notes",
        current: index + 1,
        total: noteIds.length,
      });
    }
    const assetIds = await adapter.listAssets();
    progress({ phase: "delete-assets", current: 0, total: assetIds.length });
    for (const [index, assetId] of assetIds.entries()) {
      // eslint-disable-next-line no-await-in-loop
      await adapter.deleteAsset(assetId);
      progress({
        phase: "delete-assets",
        current: index + 1,
        total: assetIds.length,
      });
    }
  }

  await adapter.writeVault({
    ...vault,
    // Rebuilt by adapter.writeNote calls.
    notesIndex: {},
    templatesIndex: {},
    updatedAt: Math.max(vault.updatedAt, Date.now()),
  });

  progress({
    phase: "write-notes",
    current: 0,
    total: notes.length,
  });
  for (const [index, entry] of notes.entries()) {
    // eslint-disable-next-line no-await-in-loop
    await adapter.writeNote({
      noteId: entry.noteId,
      noteDocument: entry.noteDocument,
      derivedMarkdown: entry.derivedMarkdown,
    });
    progress({
      phase: "write-notes",
      current: index + 1,
      total: notes.length,
    });
  }

  progress({
    phase: "write-assets",
    current: 0,
    total: assets.length,
  });
  for (const [index, entry] of assets.entries()) {
    const bytes = base64ToBytes(entry.dataBase64);
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    // eslint-disable-next-line no-await-in-loop
    await adapter.writeAsset({
      assetId: entry.assetId,
      blob: new Blob([copy], { type: entry.mime }),
      meta: { mime: entry.mime, size: copy.byteLength },
    });
    progress({
      phase: "write-assets",
      current: index + 1,
      total: assets.length,
    });
  }
};

export const triggerBrowserDownload = (input: {
  blob: Blob;
  fileName: string;
}): void => {
  const { blob, fileName } = input;
  // eslint-disable-next-line compat/compat
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.click();
  // Revoke later to avoid disrupting the download in some browsers.
  globalThis.setTimeout(() => {
    // eslint-disable-next-line compat/compat
    URL.revokeObjectURL(url);
  }, 30_000);
};
