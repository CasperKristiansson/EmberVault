import { writable } from "svelte/store";

export type ReplaceWikiLinkCommand = {
  id: string;
  noteId: string;
  type: "replace-wiki-link";
  raw: string;
  targetId: string;
};

export type ReplaceWikiLinksCommand = {
  id: string;
  noteId: string;
  type: "replace-wiki-links";
  replacements: Array<{ raw: string; targetId: string }>;
};

export type EditorCommand = ReplaceWikiLinkCommand | ReplaceWikiLinksCommand;

export const editorCommandStore = writable<EditorCommand | null>(null);

export const dispatchEditorCommand = (command: EditorCommand): void => {
  editorCommandStore.set(command);
};

