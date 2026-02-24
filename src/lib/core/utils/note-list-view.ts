export const noteListViews = {
  notes: "notes",
  projects: "projects",
} as const;

export type NoteListView = (typeof noteListViews)[keyof typeof noteListViews];

export const resolveNoteListView = (projectsOpen: boolean): NoteListView =>
  projectsOpen ? noteListViews.projects : noteListViews.notes;
