import { extractAssetIdsFromPmDocument } from "$lib/core/editor/images/extract-asset-ids";
import { resolveOutgoingLinks } from "$lib/core/editor/links/parse";
import type {
  NoteDocumentFile,
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

const validateFolderTree = (vault: Vault): VaultIntegrityIssue[] => {
  const issues: VaultIntegrityIssue[] = [];
  for (const [folderId, folder] of Object.entries(vault.folders)) {
    const entry = folder;
    if (
      entry.parentId !== null &&
      !Object.hasOwn(vault.folders, entry.parentId)
    ) {
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

const buildMissingNoteIssues = (
  missingNoteIds: string[]
): VaultIntegrityIssue[] => {
  const issues: VaultIntegrityIssue[] = [];
  for (const missing of missingNoteIds) {
    issues.push({
      severity: "error",
      message: "Vault index references a note that could not be loaded.",
      noteId: missing,
    });
  }
  return issues;
};

const buildUnresolvedLinkIssues = (
  entries: { noteId: string; raw: string }[]
): VaultIntegrityIssue[] => {
  const issues: VaultIntegrityIssue[] = [];
  for (const entry of entries) {
    issues.push({
      severity: "info",
      message: `Note has an unresolved/ambiguous wiki link: [[${entry.raw}]]`,
      noteId: entry.noteId,
    });
  }
  return issues;
};

const scanNotesForIntegrity = async (input: {
  adapter: StorageAdapter;
  vault: Vault;
}): Promise<{
  missingNoteIds: string[];
  referencedAssetIds: Set<string>;
  unresolvedLinks: { noteId: string; raw: string }[];
}> => {
  const notesIndex = Object.values(input.vault.notesIndex);
  const noteIds = Object.keys(input.vault.notesIndex);
  const knownNoteIds = new Set(noteIds);

  const referencedAssetIds = new Set<string>();
  const missingNoteIds: string[] = [];
  const unresolvedLinks: { noteId: string; raw: string }[] = [];

  const recordAssetsForNote = (note: Pick<NoteDocumentFile, "pmDoc">): void => {
    for (const assetId of extractAssetIdsFromPmDocument(note.pmDoc)) {
      referencedAssetIds.add(assetId);
    }
  };

  const recordUnresolvedLinksForNote = (inputNote: {
    noteId: string;
    plainText: string;
  }): void => {
    const outgoing = resolveOutgoingLinks(inputNote.plainText, notesIndex);
    for (const target of outgoing) {
      if (knownNoteIds.has(target)) {
        // Link resolved.
      } else {
        unresolvedLinks.push({ noteId: inputNote.noteId, raw: target });
      }
    }
  };

  for (const noteId of noteIds) {
    // eslint-disable-next-line no-await-in-loop
    const note = await input.adapter.readNote(noteId);
    if (note) {
      recordAssetsForNote(note);
      recordUnresolvedLinksForNote({
        noteId,
        plainText: note.derived?.plainText ?? "",
      });
    } else {
      missingNoteIds.push(noteId);
    }
  }

  return { missingNoteIds, referencedAssetIds, unresolvedLinks };
};

const buildAssetIssues = async (input: {
  adapter: StorageAdapter;
  referencedAssetIds: Set<string>;
}): Promise<VaultIntegrityIssue[]> => {
  const assetIds = await input.adapter.listAssets();
  const assetIdSet = new Set(assetIds);

  const issues: VaultIntegrityIssue[] = [];
  for (const assetId of assetIds) {
    if (!input.referencedAssetIds.has(assetId)) {
      issues.push({
        severity: "warning",
        message: "Asset is not referenced by any note (orphan).",
        assetId,
      });
    }
  }
  for (const assetId of input.referencedAssetIds) {
    if (!assetIdSet.has(assetId)) {
      issues.push({
        severity: "warning",
        message: "Note references an asset that is missing.",
        assetId,
      });
    }
  }
  return issues;
};

export const runVaultIntegrityCheck = async (input: {
  adapter: StorageAdapter;
  vault: Vault;
}): Promise<VaultIntegrityReport> => {
  const folderIssues = validateFolderTree(input.vault);
  const noteScan = await scanNotesForIntegrity(input);
  const missingNoteIssues = buildMissingNoteIssues(noteScan.missingNoteIds);
  const unresolvedLinkIssues = buildUnresolvedLinkIssues(
    noteScan.unresolvedLinks
  );
  const assetIssues = await buildAssetIssues({
    adapter: input.adapter,
    referencedAssetIds: noteScan.referencedAssetIds,
  });

  const issues = [
    ...folderIssues,
    ...missingNoteIssues,
    ...unresolvedLinkIssues,
    ...assetIssues,
  ];

  return {
    checkedAt: Date.now(),
    issues,
  };
};

const filterKnownChildFolderIds = (
  childFolderIds: string[],
  knownFolderIds: Set<string>
): string[] => {
  const resolved: string[] = [];
  for (const childId of childFolderIds) {
    if (knownFolderIds.has(childId)) {
      resolved.push(childId);
    }
  }
  return resolved;
};

const uniqStrings = (values: string[]): string[] => {
  const resolved: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      resolved.push(value);
    }
  }
  return resolved;
};

export const applyVaultIntegrityRepairs = async (input: {
  adapter: StorageAdapter;
  vault: Vault;
  report: VaultIntegrityReport;
}): Promise<VaultIntegrityReport> => {
  const repairFolderReferences = (vault: Vault): Vault => {
    const repairedFolders: Vault["folders"] = {};
    const knownFolderIds = new Set(Object.keys(vault.folders));
    for (const [folderId, folder] of Object.entries(vault.folders)) {
      const entry = folder;
      repairedFolders[folderId] = {
        ...entry,
        parentId:
          entry.parentId !== null && knownFolderIds.has(entry.parentId)
            ? entry.parentId
            : null,
        childFolderIds: filterKnownChildFolderIds(
          entry.childFolderIds,
          knownFolderIds
        ),
      };
    }
    return {
      ...vault,
      folders: repairedFolders,
      updatedAt: Math.max(vault.updatedAt, Date.now()),
    };
  };

  const pruneMissingNotesFromIndex = async (
    vault: Vault
  ): Promise<{
    vault: Vault;
    issues: VaultIntegrityIssue[];
  }> => {
    const issues: VaultIntegrityIssue[] = [];
    const remainingNotesIndex: Record<string, NoteIndexEntry> = {};
    for (const [noteId, entry] of Object.entries(vault.notesIndex)) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await input.adapter.readNote(noteId);
      if (exists) {
        remainingNotesIndex[noteId] = entry;
      } else {
        issues.push({
          severity: "error",
          message: "Removed missing note from vault index.",
          noteId,
        });
      }
    }
    return { vault: { ...vault, notesIndex: remainingNotesIndex }, issues };
  };

  const collectReferencedAssetIds = async (
    notesIndex: Record<string, NoteIndexEntry>
  ): Promise<Set<string>> => {
    const referencedAssetIds = new Set<string>();
    for (const noteId of Object.keys(notesIndex)) {
      // eslint-disable-next-line no-await-in-loop
      const note = await input.adapter.readNote(noteId);
      if (note) {
        for (const assetId of extractAssetIdsFromPmDocument(note.pmDoc)) {
          referencedAssetIds.add(assetId);
        }
      }
    }
    return referencedAssetIds;
  };

  const deleteOrphanAssets = async (
    referencedAssetIds: Set<string>
  ): Promise<VaultIntegrityIssue[]> => {
    const issues: VaultIntegrityIssue[] = [];
    const assetIds = await input.adapter.listAssets();
    const orphanCandidates: string[] = [];
    for (const assetId of assetIds) {
      if (!referencedAssetIds.has(assetId)) {
        orphanCandidates.push(assetId);
      }
    }
    const orphanAssetIds = uniqStrings(orphanCandidates);
    for (const assetId of orphanAssetIds) {
      // eslint-disable-next-line no-await-in-loop
      await input.adapter.deleteAsset(assetId);
      issues.push({
        severity: "warning",
        message: "Deleted orphan asset.",
        assetId,
      });
    }
    return issues;
  };

  const repairedVault = repairFolderReferences(input.vault);
  const prunedNotes = await pruneMissingNotesFromIndex(repairedVault);
  const referencedAssetIds = await collectReferencedAssetIds(
    prunedNotes.vault.notesIndex
  );
  const assetIssues = await deleteOrphanAssets(referencedAssetIds);

  await input.adapter.writeVault(prunedNotes.vault);
  const followUp = await runVaultIntegrityCheck({
    adapter: input.adapter,
    vault: prunedNotes.vault,
  });
  return {
    ...followUp,
    issues: [...prunedNotes.issues, ...assetIssues, ...followUp.issues],
  };
};
