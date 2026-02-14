import { resolveAssetExtension } from "$lib/core/storage/filesystem/assets";
import { listDirectoryEntries } from "$lib/core/storage/filesystem/handles";
import {
  writeBlobFile,
  writeTextFile,
} from "$lib/core/storage/filesystem/file-io";
import { toDerivedMarkdown } from "$lib/core/utils/derived-markdown";
import type {
  Folder,
  NoteDocumentFile,
  StorageAdapter,
  Vault,
} from "$lib/core/storage/types";

const sanitizeFileSystemCharacters = (input: string): string => {
  const forbidden = String.raw`\/:*?"<>|`;
  let output = "";
  for (const character of input) {
    const codePoint = character.codePointAt(0) ?? 0;
    const isControlCharacter = codePoint < 32;
    const isForbiddenCharacter = forbidden.includes(character);
    output += isControlCharacter || isForbiddenCharacter ? "_" : character;
  }
  return output;
};

const trimDots = (value: string): string => {
  let result = value;
  while (result.startsWith(".")) {
    result = result.slice(1);
  }
  while (result.endsWith(".")) {
    result = result.slice(0, -1);
  }
  return result;
};

export const sanitizePathSegment = (
  input: string,
  fallback: string
): string => {
  const cleaned = trimDots(
    sanitizeFileSystemCharacters(input.trim()).replaceAll(/\s+/gu, " ").trim()
  );

  const resolved = cleaned.length > 0 ? cleaned : fallback;
  if (resolved === "." || resolved === "..") {
    return fallback;
  }
  // Keep names readable and avoid filesystem edge cases with very long segments.
  return resolved.length > 80 ? resolved.slice(0, 80).trim() : resolved;
};

export const resolveFolderPathSegments = (
  vault: Vault,
  folderId: string | null
): string[] => {
  if (!folderId) {
    return [];
  }
  const segments: string[] = [];
  const seen = new Set<string>();
  let current: string | null = folderId;
  for (let depth = 0; depth < 50 && current !== null; depth += 1) {
    if (seen.has(current)) {
      return segments.toReversed();
    }
    seen.add(current);
    const folder = vault.folders[current] as Folder | undefined;
    if (!folder) {
      return segments.toReversed();
    }
    segments.push(sanitizePathSegment(folder.name, "Untitled folder"));
    current = folder.parentId;
  }
  return segments.toReversed();
};

export const buildExportNoteFileName = (
  note: Pick<NoteDocumentFile, "id" | "title">
): string => {
  const safeTitle = sanitizePathSegment(note.title || "", "Untitled");
  return `${safeTitle} - ${note.id}.md`;
};

const pad2 = (value: number): string => String(value).padStart(2, "0");

export const formatExportFolderName = (now: Date): string => {
  const yyyy = now.getFullYear();
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const min = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());
  return `EmberVault Export ${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
};

const ensureDirectoryPath = async (
  base: FileSystemDirectoryHandle,
  segments: string[]
): Promise<FileSystemDirectoryHandle> => {
  if (segments.length === 0) {
    return base;
  }
  const [first, ...rest] = segments;
  const next = await base.getDirectoryHandle(first, { create: true });
  return ensureDirectoryPath(next, rest);
};

const resolveExportTargetDirectory = async (
  directory: FileSystemDirectoryHandle,
  now: Date
): Promise<FileSystemDirectoryHandle> => {
  const existing = await listDirectoryEntries(directory);
  if (existing.length === 0) {
    return directory;
  }
  const name = formatExportFolderName(now);
  return directory.getDirectoryHandle(name, { create: true });
};

export const exportVaultToDirectory = async (input: {
  vault: Vault;
  adapter: StorageAdapter;
  directory: FileSystemDirectoryHandle;
  now?: Date;
}): Promise<void> => {
  const now = input.now ?? new Date();
  const exportRoot = await resolveExportTargetDirectory(input.directory, now);
  const notesRoot = await exportRoot.getDirectoryHandle("notes", {
    create: true,
  });
  const assetsRoot = await exportRoot.getDirectoryHandle("assets", {
    create: true,
  });

  const notes = Object.values(input.vault.notesIndex).filter(
    // eslint-disable-next-line sonarjs/arrow-function-convention
    (entry) => entry.deletedAt === null
  );

  for (const entry of notes) {
    // eslint-disable-next-line no-await-in-loop
    const note = await input.adapter.readNote(entry.id);
    if (note) {
      const folderId = note.folderId ?? entry.folderId ?? null;
      const folderSegments = resolveFolderPathSegments(input.vault, folderId);
      // eslint-disable-next-line no-await-in-loop
      const targetDirectory = await ensureDirectoryPath(
        notesRoot,
        folderSegments
      );
      const fileName = buildExportNoteFileName(note);
      const plainText = note.derived?.plainText ?? "";
      const markdown = toDerivedMarkdown(note.title, plainText);
      // eslint-disable-next-line no-await-in-loop
      await writeTextFile(targetDirectory, fileName, markdown);
    }
  }

  const assetIds = await input.adapter.listAssets();
  for (const assetId of assetIds) {
    // eslint-disable-next-line no-await-in-loop
    const blob = await input.adapter.readAsset(assetId);
    if (blob) {
      const extension = resolveAssetExtension(blob.type);
      // eslint-disable-next-line no-await-in-loop
      await writeBlobFile(assetsRoot, `${assetId}.${extension}`, blob);
    }
  }
};
