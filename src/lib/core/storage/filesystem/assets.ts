import { isFileHandle, listDirectoryEntries } from "./handles";

const mimeToExtension: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export const resolveAssetExtension = (mime?: string): string => {
  if (!mime) {
    return "bin";
  }
  return mimeToExtension[mime] ?? "bin";
};

export const findAssetHandle = async (
  assetsDirectory: FileSystemDirectoryHandle,
  assetId: string
): Promise<FileSystemFileHandle | null> => {
  const entries = await listDirectoryEntries(assetsDirectory);
  for (const entry of entries) {
    if (isFileHandle(entry)) {
      const { name } = entry;
      if (name === assetId || name.startsWith(`${assetId}.`)) {
        return entry;
      }
    }
  }
  return null;
};
