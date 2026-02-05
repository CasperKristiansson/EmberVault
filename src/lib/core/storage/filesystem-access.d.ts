/* eslint-disable @typescript-eslint/consistent-type-definitions */
interface FileSystemDirectoryHandle {
  values: () => AsyncIterableIterator<FileSystemHandle>;
}
