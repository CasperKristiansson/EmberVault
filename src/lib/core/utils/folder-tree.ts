/* eslint-disable sonarjs/arrow-function-convention */
import type {
  Folder,
  FolderTree,
  NoteIndexEntry,
} from "$lib/core/storage/types";

type FolderInput = {
  id: string;
  name: string;
  parentId: string | null;
};

export const createFolderEntry = (input: FolderInput): Folder => ({
  id: input.id,
  name: input.name,
  parentId: input.parentId,
  childFolderIds: [],
});

export const addFolder = (
  folders: FolderTree,
  input: FolderInput
): FolderTree => {
  const nextFolders: FolderTree = {
    ...folders,
    [input.id]: createFolderEntry(input),
  };

  if (input.parentId) {
    const parent = folders[input.parentId] as Folder | undefined;
    if (!parent) {
      return nextFolders;
    }
    nextFolders[input.parentId] = {
      ...parent,
      childFolderIds: [...parent.childFolderIds, input.id],
    };
  }

  return nextFolders;
};

export const renameFolder = (
  folders: FolderTree,
  folderId: string,
  name: string
): FolderTree => {
  const folder = folders[folderId] as Folder | undefined;
  const trimmedName = name.trim();

  if (!folder || trimmedName.length === 0 || trimmedName === folder.name) {
    return folders;
  }

  return {
    ...folders,
    [folderId]: {
      ...folder,
      name: trimmedName,
    },
  };
};

export const removeFolder = (
  folders: FolderTree,
  folderId: string
): FolderTree => {
  const folder = folders[folderId] as Folder | undefined;
  if (!folder) {
    return folders;
  }

  const nextFolders: FolderTree = Object.fromEntries(
    Object.entries(folders).filter(([id]) => id !== folderId)
  );

  if (folder.parentId) {
    const parent = nextFolders[folder.parentId] as Folder | undefined;
    if (!parent) {
      return nextFolders;
    }
    nextFolders[folder.parentId] = {
      ...parent,
      childFolderIds: parent.childFolderIds.filter((id) => id !== folderId),
    };
  }

  return nextFolders;
};

export const isFolderEmpty = (
  folderId: string,
  folders: FolderTree,
  notesIndex: Record<string, NoteIndexEntry>
): boolean => {
  const folder = folders[folderId] as Folder | undefined;
  if (!folder) {
    return true;
  }

  if (folder.childFolderIds.length > 0) {
    return false;
  }

  const hasNotes = Object.values(notesIndex).some(
    (note) => note.folderId === folderId && note.deletedAt === null
  );

  return !hasNotes;
};

export const getRootFolderIds = (folders: FolderTree): string[] =>
  Object.keys(folders).filter((id) => {
    const folder = folders[id] as Folder | undefined;
    return folder?.parentId === null;
  });

export const getChildFolderIds = (
  folderId: string,
  folders: FolderTree
): string[] => {
  const folder = folders[folderId] as Folder | undefined;
  if (!folder) {
    return [];
  }

  return folder.childFolderIds.filter((id) => {
    const child = folders[id] as Folder | undefined;
    return Boolean(child);
  });
};
