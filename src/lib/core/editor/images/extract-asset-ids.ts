const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const extractAssetIdsFromPmDoc = (
  pmDoc: Record<string, unknown>
): string[] => {
  const ids = new Set<string>();

  const visit = (node: unknown): void => {
    if (!isRecord(node)) {
      return;
    }
    const type = node.type;
    if (type === "image") {
      const attrs = node.attrs;
      if (isRecord(attrs) && typeof attrs.assetId === "string") {
        ids.add(attrs.assetId);
      }
    }
    const content = node.content;
    if (Array.isArray(content)) {
      for (const child of content) {
        visit(child);
      }
    }
  };

  visit(pmDoc);
  return [...ids];
};

