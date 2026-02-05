import { isNotFoundError } from "./handles";

export const readTextFile = async (
  directory: FileSystemDirectoryHandle,
  fileName: string
): Promise<string | null> => {
  try {
    const handle = await directory.getFileHandle(fileName);
    const file = await handle.getFile();
    return await file.text();
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
};

export const writeTextFile = async (
  directory: FileSystemDirectoryHandle,
  fileName: string,
  contents: string
): Promise<void> => {
  const handle = await directory.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(contents);
  await writable.close();
};

export const writeBlobFile = async (
  directory: FileSystemDirectoryHandle,
  fileName: string,
  blob: Blob
): Promise<void> => {
  const handle = await directory.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
};

export const readJsonFile = async <T>(
  directory: FileSystemDirectoryHandle,
  fileName: string
): Promise<T | null> => {
  const text = await readTextFile(directory, fileName);
  if (text === null) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return JSON.parse(text) as T;
};

export const writeJsonFile = async (
  directory: FileSystemDirectoryHandle,
  fileName: string,
  payload: unknown
): Promise<void> => {
  const serialized = JSON.stringify(payload);
  await writeTextFile(directory, fileName, serialized);
};
