export type NotesViewFilters = {
  activeFolderId: string | null;
  favoritesOnly: boolean;
};

export const openAllNotesView = (
  state: NotesViewFilters
): NotesViewFilters => ({
  ...state,
  activeFolderId: null,
  favoritesOnly: false,
});
