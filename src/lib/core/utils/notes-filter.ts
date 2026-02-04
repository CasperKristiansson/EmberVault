/* eslint-disable sonarjs/arrow-function-convention */
import type { NoteIndexEntry } from "$lib/core/storage/types";

export const filterNotesByFolder = (
  notes: NoteIndexEntry[],
  folderId: string | null
): NoteIndexEntry[] => {
  const activeNotes = notes.filter((note) => note.deletedAt === null);
  if (!folderId) {
    return activeNotes;
  }
  return activeNotes.filter((note) => note.folderId === folderId);
};

export const filterNotesByFavorites = (
  notes: NoteIndexEntry[],
  favoritesOnly: boolean
): NoteIndexEntry[] => {
  if (!favoritesOnly) {
    return notes;
  }
  return notes.filter((note) => note.favorite);
};
