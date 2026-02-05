import { projectFileName } from "./constants";
import { readJsonFile, writeJsonFile } from "./file-io";
import type { Project } from "../types";

export const readProjectFile = async (
  projectDirectory: FileSystemDirectoryHandle
): Promise<Project | null> =>
  readJsonFile<Project>(projectDirectory, projectFileName);

export const writeProjectFile = async (
  projectDirectory: FileSystemDirectoryHandle,
  project: Project
): Promise<void> => {
  await writeJsonFile(projectDirectory, projectFileName, project);
};
