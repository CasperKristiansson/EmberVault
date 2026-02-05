import { createUlid } from "../../utils/ulid";
import type { Project } from "../types";

const defaultProjectName = "Personal";

export const createDefaultProject = (): Project => {
  const timestamp = Date.now();
  return {
    id: createUlid(),
    name: defaultProjectName,
    createdAt: timestamp,
    updatedAt: timestamp,
    folders: {},
    tags: {},
    notesIndex: {},
    templatesIndex: {},
    settings: {},
  };
};
