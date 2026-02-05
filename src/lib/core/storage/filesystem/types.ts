import type { UIState } from "../types";

export type VaultManifest = {
  version: number;
  uiState?: UIState;
  searchIndex?: Record<string, string>;
};

export type ProjectDirectories = {
  project: FileSystemDirectoryHandle;
  notes: FileSystemDirectoryHandle;
  templates: FileSystemDirectoryHandle;
  assets: FileSystemDirectoryHandle;
  trash: FileSystemDirectoryHandle;
};
