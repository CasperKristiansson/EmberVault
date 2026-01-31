/* eslint-disable sonarjs/arrow-function-convention */
import type {
  Folder,
  FolderTree,
  NoteIndexEntry,
} from "$lib/core/storage/types";

const filterActiveNotes = (notes: NoteIndexEntry[]): NoteIndexEntry[] =>
  notes.filter((note) => note.deletedAt === null);

export const orderNotesForFolder = (
  notes: NoteIndexEntry[],
  folderId: string | null,
  folders: FolderTree
): NoteIndexEntry[] => {
  const activeNotes = filterActiveNotes(notes);
  if (!folderId) {
    return activeNotes;
  }
  const folderNotes = activeNotes.filter((note) => note.folderId === folderId);
  const folder = folders[folderId] as Folder | undefined;
  const noteOrder = folder?.noteIds ?? [];
  if (noteOrder.length === 0) {
    return folderNotes;
  }
  const noteMap = new Map(folderNotes.map((note) => [note.id, note]));
  const ordered: NoteIndexEntry[] = [];
  for (const id of noteOrder) {
    const note = noteMap.get(id);
    if (note) {
      ordered.push(note);
      noteMap.delete(id);
    }
  }
  const remaining = folderNotes.filter((note) => noteMap.has(note.id));
  return [...ordered, ...remaining];
};

export const resolveFolderNoteOrder = (
  notes: NoteIndexEntry[],
  folderId: string,
  folders: FolderTree
): string[] =>
  orderNotesForFolder(notes, folderId, folders).map((note) => note.id);

export const reorderNoteIds = (
  noteIds: string[],
  fromId: string,
  toId: string
): string[] => {
  if (fromId === toId) {
    return noteIds;
  }
  if (!noteIds.includes(fromId) || !noteIds.includes(toId)) {
    return noteIds;
  }
  const filtered = noteIds.filter((id) => id !== fromId);
  const targetIndex = filtered.indexOf(toId);
  if (targetIndex === -1) {
    return noteIds;
  }
  const next = [...filtered];
  next.splice(targetIndex, 0, fromId);
  return next;
};

const noteIdsEqual = (first: string[], second: string[]): boolean => {
  if (first.length !== second.length) {
    return false;
  }
  return first.every((value, index) => value === second[index]);
};

export const setFolderNoteOrder = (
  folders: FolderTree,
  folderId: string,
  noteIds: string[]
): FolderTree => {
  const folder = folders[folderId] as Folder | undefined;
  if (!folder) {
    return folders;
  }
  const current = folder.noteIds ?? [];
  if (noteIdsEqual(current, noteIds)) {
    return folders;
  }
  return {
    ...folders,
    [folderId]: {
      ...folder,
      noteIds,
    },
  };
};
