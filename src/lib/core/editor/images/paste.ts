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

const isClipboardItemList = (value: unknown): value is ClipboardItemList => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const list = value as {
    length?: unknown;
    item?: unknown;
  };
  return typeof list.length === "number" && typeof list.item === "function";
};

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

export const extractImageFromClipboard = (
  clipboardData: ClipboardDataLike | null | undefined
): File | null => {
  const items = clipboardData?.items;
  if (!items) {
    return null;
  }
  return findImageFile(normalizeClipboardItems(items));
};
