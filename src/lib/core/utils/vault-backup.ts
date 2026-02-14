import { toDerivedMarkdown } from "$lib/core/utils/derived-markdown";
import type {
  NoteDocumentFile,
  StorageAdapter,
  Vault,
} from "$lib/core/storage/types";

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
  // eslint-disable-next-line compat/compat
  typeof CompressionStream !== "undefined" &&
  // eslint-disable-next-line compat/compat
  typeof DecompressionStream !== "undefined";

const bytesToBase64 = (bytes: Uint8Array): string => {
  // Chunk to avoid call stack and argument limits.
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const buffer = await blob.arrayBuffer();
  return bytesToBase64(new Uint8Array(buffer));
};

const gzipBlobIfSupported = async (blob: Blob): Promise<Blob> => {
  if (!hasCompressionStreams()) {
    return blob;
  }
  // eslint-disable-next-line compat/compat
  const stream = blob.stream().pipeThrough(new CompressionStream("gzip"));
  return new Blob([await new Response(stream).arrayBuffer()], {
    type: "application/gzip",
  });
};

const looksLikeGzip = async (blob: Blob): Promise<boolean> => {
  if (blob.type === "application/gzip") {
    return true;
  }
  const header = await blob.slice(0, 2).arrayBuffer();
  const bytes = new Uint8Array(header);
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
};

const gunzipBlobIfNeeded = async (blob: Blob): Promise<Blob> => {
  if (!hasCompressionStreams()) {
    return blob;
  }
  if (!(await looksLikeGzip(blob))) {
    return blob;
  }
  // eslint-disable-next-line compat/compat
  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
  return new Blob([await new Response(stream).arrayBuffer()], {
    type: "application/json",
  });
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
    if (!note) {
      continue;
    }
    const derivedMarkdown = toDerivedMarkdown(
      note.title,
      note.derived?.plainText ?? ""
    );
    notes.push({ noteId, noteDocument: note, derivedMarkdown });
  }

  const assetIds = await input.adapter.listAssets();
  const assets: BackupAssetEntry[] = [];
  for (const assetId of assetIds) {
    // eslint-disable-next-line no-await-in-loop
    const blob = await input.adapter.readAsset(assetId);
    if (!blob) {
      continue;
    }
    // mime may be empty in some adapters for unknown assets.
    const mime = blob.type || "application/octet-stream";
    // eslint-disable-next-line no-await-in-loop
    const dataBase64 = await blobToBase64(blob);
    assets.push({ assetId, mime, dataBase64 });
  }

  return {
    format: "embervault-backup",
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
  const jsonBlob = new Blob([payload], { type: "application/json" });
  const compress = input.compress !== false;
  const blob = compress ? await gzipBlobIfSupported(jsonBlob) : jsonBlob;
  const ext = blob.type === "application/gzip" ? "json.gz" : "json";
  return {
    blob,
    fileName: `embervault-backup-${input.backup.createdAt}.${ext}`,
  };
};

export const parseVaultBackup = async (input: {
  file: File | Blob;
}): Promise<VaultBackupV1> => {
  const maybeJson = await gunzipBlobIfNeeded(input.file);
  const text = await maybeJson.text();
  const parsed: unknown = JSON.parse(text);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { format?: unknown }).format !== "embervault-backup"
  ) {
    throw new Error("Unsupported backup file.");
  }
  const version = (parsed as { version?: unknown }).version;
  if (version !== 1) {
    throw new Error(`Unsupported backup version ${String(version)}.`);
  }
  return parsed as VaultBackupV1;
};

export const restoreVaultBackup = async (input: {
  adapter: StorageAdapter;
  backup: VaultBackupV1;
  onProgress?: (value: { phase: string; current: number; total: number }) => void;
}): Promise<void> => {
  const progress = input.onProgress ?? (() => {});
  const vault = input.backup.vault;

  // Best-effort wipe of existing content to avoid mixing vaults.
  const existingVault = await input.adapter.readVault();
  if (existingVault) {
    const noteIds = Object.keys(existingVault.notesIndex);
    progress({ phase: "delete-notes", current: 0, total: noteIds.length });
    for (const [index, noteId] of noteIds.entries()) {
      // eslint-disable-next-line no-await-in-loop
      await input.adapter.deleteNotePermanent(noteId);
      progress({
        phase: "delete-notes",
        current: index + 1,
        total: noteIds.length,
      });
    }
    const assetIds = await input.adapter.listAssets();
    progress({ phase: "delete-assets", current: 0, total: assetIds.length });
    for (const [index, assetId] of assetIds.entries()) {
      // eslint-disable-next-line no-await-in-loop
      await input.adapter.deleteAsset(assetId);
      progress({
        phase: "delete-assets",
        current: index + 1,
        total: assetIds.length,
      });
    }
  }

  await input.adapter.writeVault({
    ...vault,
    // Rebuilt by adapter.writeNote calls.
    notesIndex: {},
    templatesIndex: {},
    updatedAt: Math.max(vault.updatedAt, Date.now()),
  });

  progress({ phase: "write-notes", current: 0, total: input.backup.notes.length });
  for (const [index, entry] of input.backup.notes.entries()) {
    // eslint-disable-next-line no-await-in-loop
    await input.adapter.writeNote({
      noteId: entry.noteId,
      noteDocument: entry.noteDocument,
      derivedMarkdown: entry.derivedMarkdown,
    });
    progress({
      phase: "write-notes",
      current: index + 1,
      total: input.backup.notes.length,
    });
  }

  progress({
    phase: "write-assets",
    current: 0,
    total: input.backup.assets.length,
  });
  for (const [index, entry] of input.backup.assets.entries()) {
    // eslint-disable-next-line no-await-in-loop
    const bytes = base64ToBytes(entry.dataBase64);
    // eslint-disable-next-line no-await-in-loop
    await input.adapter.writeAsset({
      assetId: entry.assetId,
      blob: new Blob([bytes], { type: entry.mime }),
      meta: { mime: entry.mime, size: bytes.byteLength },
    });
    progress({
      phase: "write-assets",
      current: index + 1,
      total: input.backup.assets.length,
    });
  }
};

export const triggerBrowserDownload = (input: {
  blob: Blob;
  fileName: string;
}): void => {
  const url = URL.createObjectURL(input.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = input.fileName;
  link.rel = "noopener";
  link.click();
  // Revoke later to avoid disrupting the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};
