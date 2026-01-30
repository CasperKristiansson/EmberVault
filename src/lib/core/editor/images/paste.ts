type ClipboardFileItem = {
  kind: string;
  type: string;
  getAsFile: () => File | null;
};

type ClipboardItemList = {
  length: number;
  item: (index: number) => unknown;
};

type ClipboardDataLike = {
  items?: unknown;
};

type FileListLike = {
  length: number;
  item: (index: number) => File | null;
};

type DataTransferLike = {
  items?: unknown;
  files?: unknown;
};

type ListWithItem = {
  length: number;
  item: (index: number) => unknown;
};

const isClipboardItem = (value: unknown): value is ClipboardFileItem => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as {
    kind?: unknown;
    type?: unknown;
    getAsFile?: unknown;
  };
  return (
    typeof item.kind === "string" &&
    typeof item.type === "string" &&
    typeof item.getAsFile === "function"
  );
};

const isListWithItem = (value: unknown): value is ListWithItem => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const list = value as {
    length?: unknown;
    item?: unknown;
  };
  return typeof list.length === "number" && typeof list.item === "function";
};

const isClipboardItemList = (value: unknown): value is ClipboardItemList =>
  isListWithItem(value);

const normalizeClipboardItems = (items: unknown): ClipboardFileItem[] => {
  if (Array.isArray(items)) {
    return items.filter(isClipboardItem);
  }
  if (!isClipboardItemList(items)) {
    return [];
  }
  const normalized: ClipboardFileItem[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items.item(index);
    if (isClipboardItem(item)) {
      normalized.push(item);
    }
  }
  return normalized;
};

const isFileList = (value: unknown): value is FileListLike =>
  isListWithItem(value);

const normalizeFileList = (files: unknown): File[] => {
  if (Array.isArray(files)) {
    return files.filter((entry): entry is File => entry instanceof File);
  }
  if (!isFileList(files)) {
    return [];
  }
  const normalized: File[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const entry = files.item(index);
    if (entry instanceof File) {
      normalized.push(entry);
    }
  }
  return normalized;
};

const findImageFile = (items: ClipboardFileItem[]): File | null => {
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        return file;
      }
    }
  }
  return null;
};

const findImageFileFromFiles = (files: File[]): File | null => {
  for (const file of files) {
    if (file.type.startsWith("image/")) {
      return file;
    }
  }
  return null;
};

export const extractImageFromClipboard = (
  clipboardData: ClipboardDataLike | null | undefined
): File | null => {
  const items = clipboardData?.items;
  if (!items) {
    return null;
  }
  return findImageFile(normalizeClipboardItems(items));
};

export const extractImageFromDataTransfer = (
  dataTransfer: DataTransferLike | null | undefined
): File | null => {
  if (!dataTransfer) {
    return null;
  }
  const { items, files } = dataTransfer;
  const itemFile = items ? findImageFile(normalizeClipboardItems(items)) : null;
  if (itemFile) {
    return itemFile;
  }
  return findImageFileFromFiles(normalizeFileList(files));
};
