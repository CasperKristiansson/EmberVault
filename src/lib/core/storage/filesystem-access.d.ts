/* eslint-disable @typescript-eslint/consistent-type-definitions */
interface FileSystemDirectoryHandle {
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<FileSystemDirectoryHandle>;
  values: () => AsyncIterableIterator<FileSystemHandle>;
}

interface FileSystemFileHandle {
  getFile: () => Promise<File>;
}

interface Window {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
}
