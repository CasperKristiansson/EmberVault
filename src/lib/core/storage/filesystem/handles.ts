export const isNotFoundError = (error: unknown): boolean =>
  error instanceof Error && error.name === "NotFoundError";

export const isDirectoryHandle = (
  entry: FileSystemHandle
): entry is FileSystemDirectoryHandle => entry.kind === "directory";

export const isFileHandle = (
  entry: FileSystemHandle
): entry is FileSystemFileHandle => entry.kind === "file";

export const listDirectoryEntries = async (
  directory: FileSystemDirectoryHandle
): Promise<FileSystemHandle[]> => {
  const entries: FileSystemHandle[] = [];
  const iterator = directory.values();
  for await (const entry of iterator) {
    entries.push(entry);
  }
  return entries;
};

export const removeEntryIfExists = async (
  directory: FileSystemDirectoryHandle,
  name: string
): Promise<void> => {
  try {
    await directory.removeEntry(name);
  } catch (error) {
    if (isNotFoundError(error)) {
      return;
    }
    throw error;
  }
};
