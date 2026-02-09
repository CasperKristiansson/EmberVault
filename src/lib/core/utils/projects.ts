import type { Vault } from "$lib/core/storage/types";

export const sortProjectsByUpdatedAt = (projects: Vault[]): Vault[] =>
  projects.toSorted((first, second) => second.updatedAt - first.updatedAt);

export const sortVaultsByUpdatedAt = sortProjectsByUpdatedAt;
