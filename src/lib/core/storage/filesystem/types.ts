import type { UIState, Vault } from "../types";

export type VaultManifest = {
  version: number;
  vault?: Vault;
  uiState?: UIState;
  searchIndex?: string;
};

export type VaultDirectories = {
  notes: FileSystemDirectoryHandle;
  templates: FileSystemDirectoryHandle;
  assets: FileSystemDirectoryHandle;
  trash: FileSystemDirectoryHandle;
};
