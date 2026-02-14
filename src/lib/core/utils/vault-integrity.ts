import { extractAssetIdsFromPmDoc } from "$lib/core/editor/images/extract-asset-ids";
import { resolveOutgoingLinks } from "$lib/core/editor/links/parse";
import type {
  Folder,
  NoteIndexEntry,
  StorageAdapter,
  Vault,
} from "$lib/core/storage/types";

export type VaultIntegritySeverity = "error" | "warning" | "info";

export type VaultIntegrityIssue = {
  severity: VaultIntegritySeverity;
  message: string;
  noteId?: string;
  assetId?: string;
  folderId?: string;
};

export type VaultIntegrityReport = {
  checkedAt: number;
  issues: VaultIntegrityIssue[];
};

const uniq = <T>(values: T[]): T[] => [...new Set(values)];

const validateFolderTree = (vault: Vault): VaultIntegrityIssue[] => {
  const issues: VaultIntegrityIssue[] = [];
  for (const [folderId, folder] of Object.entries(vault.folders)) {
    const entry = folder as Folder;
    if (entry.parentId !== null && !Object.hasOwn(vault.folders, entry.parentId)) {
      issues.push({
        severity: "warning",
        message: "Folder has a missing parent. It will be treated as root.",
        folderId,
      });
    }
    for (const childId of entry.childFolderIds) {
      if (!Object.hasOwn(vault.folders, childId)) {
        issues.push({
          severity: "warning",
          message: "Folder references a missing child folder.",
          folderId,
        });
      }
    }
  }
  return issues;
};

export const runVaultIntegrityCheck = async (input: {
  adapter: StorageAdapter;
  vault: Vault;
}): Promise<VaultIntegrityReport> => {
  const issues: VaultIntegrityIssue[] = [];

  issues.push(...validateFolderTree(input.vault));

  const notesIndex = Object.values(input.vault.notesIndex);
  const noteIds = Object.keys(input.vault.notesIndex);
  const knownNoteIds = new Set(noteIds);

  const referencedAssetIds = new Set<string>();
  const missingNoteIds: string[] = [];
  const notesWithUnresolvedLinks: Array<{ noteId: string; raw: string }> = [];

  for (const noteId of noteIds) {
    // eslint-disable-next-line no-await-in-loop
    const note = await input.adapter.readNote(noteId);
    if (!note) {
      missingNoteIds.push(noteId);
      continue;
    }
    for (const assetId of extractAssetIdsFromPmDoc(note.pmDoc)) {
      referencedAssetIds.add(assetId);
    }

    const plainText = note.derived?.plainText ?? "";
    const outgoing = resolveOutgoingLinks(plainText, notesIndex);
    for (const target of outgoing) {
      if (!knownNoteIds.has(target)) {
        notesWithUnresolvedLinks.push({ noteId, raw: target });
      }
    }
  }

  for (const missing of missingNoteIds) {
    issues.push({
      severity: "error",
      message: "Vault index references a note that could not be loaded.",
      noteId: missing,
    });
  }

  for (const entry of notesWithUnresolvedLinks) {
    issues.push({
      severity: "info",
      message: `Note has an unresolved/ambiguous wiki link: [[${entry.raw}]]`,
      noteId: entry.noteId,
    });
  }

  const assetIds = await input.adapter.listAssets();
  const assetIdSet = new Set(assetIds);
  const referenced = referencedAssetIds;
  for (const assetId of assetIds) {
    if (!referenced.has(assetId)) {
      issues.push({
        severity: "warning",
        message: "Asset is not referenced by any note (orphan).",
        assetId,
      });
    }
  }
  for (const assetId of referenced) {
    if (!assetIdSet.has(assetId)) {
      issues.push({
        severity: "warning",
        message: "Note references an asset that is missing.",
        assetId,
      });
    }
  }

  return {
    checkedAt: Date.now(),
    issues,
  };
};

export const applyVaultIntegrityRepairs = async (input: {
  adapter: StorageAdapter;
  vault: Vault;
  report: VaultIntegrityReport;
}): Promise<VaultIntegrityReport> => {
  const nextIssues: VaultIntegrityIssue[] = [];
  let nextVault = input.vault;

  // Repair folder tree references (missing parents/children).
  const repairedFolders: Vault["folders"] = {};
  for (const [folderId, folder] of Object.entries(nextVault.folders)) {
    const entry = folder as Folder;
    repairedFolders[folderId] = {
      ...entry,
      parentId:
        entry.parentId !== null && Object.hasOwn(nextVault.folders, entry.parentId)
          ? entry.parentId
          : null,
      childFolderIds: entry.childFolderIds.filter((childId) =>
        Object.hasOwn(nextVault.folders, childId)
      ),
    };
  }
  nextVault = {
    ...nextVault,
    folders: repairedFolders,
    updatedAt: Math.max(nextVault.updatedAt, Date.now()),
  };

  // Remove notesIndex entries that cannot be loaded.
  const remainingNotesIndex: Record<string, NoteIndexEntry> = {};
  for (const [noteId, entry] of Object.entries(nextVault.notesIndex)) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await input.adapter.readNote(noteId);
    if (exists) {
      remainingNotesIndex[noteId] = entry;
    } else {
      nextIssues.push({
        severity: "error",
        message: "Removed missing note from vault index.",
        noteId,
      });
    }
  }
  nextVault = { ...nextVault, notesIndex: remainingNotesIndex };

  // Delete orphan assets.
  const referencedAssetIds = new Set<string>();
  for (const noteId of Object.keys(remainingNotesIndex)) {
    // eslint-disable-next-line no-await-in-loop
    const note = await input.adapter.readNote(noteId);
    if (!note) {
      continue;
    }
    for (const assetId of extractAssetIdsFromPmDoc(note.pmDoc)) {
      referencedAssetIds.add(assetId);
    }
  }
  const assetIds = await input.adapter.listAssets();
  const orphanAssetIds = uniq(
    assetIds.filter((assetId) => !referencedAssetIds.has(assetId))
  );
  for (const assetId of orphanAssetIds) {
    // eslint-disable-next-line no-await-in-loop
    await input.adapter.deleteAsset(assetId);
    nextIssues.push({
      severity: "warning",
      message: "Deleted orphan asset.",
      assetId,
    });
  }

  await input.adapter.writeVault(nextVault);
  const followUp = await runVaultIntegrityCheck({
    adapter: input.adapter,
    vault: nextVault,
  });
  return {
    ...followUp,
    issues: [...nextIssues, ...followUp.issues],
  };
};
