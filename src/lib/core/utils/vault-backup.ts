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
