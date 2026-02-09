import type { Vault } from "../types";

export const defaultVaultId = "vault";
export const defaultVaultName = "Vault";

export const createDefaultVault = (id: string = defaultVaultId): Vault => {
  const timestamp = Date.now();
  return {
    id,
    name: defaultVaultName,
    createdAt: timestamp,
    updatedAt: timestamp,
    folders: {},
    tags: {},
    notesIndex: {},
    templatesIndex: {},
    settings: {},
  };
};
