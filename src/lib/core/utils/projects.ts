import type { Project } from "$lib/core/storage/types";

export const sortProjectsByUpdatedAt = (projects: Project[]): Project[] =>
  projects.toSorted((first, second) => second.updatedAt - first.updatedAt);
