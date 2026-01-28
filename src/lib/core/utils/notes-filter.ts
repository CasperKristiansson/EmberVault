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
