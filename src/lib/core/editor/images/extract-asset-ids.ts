const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const extractAssetIdsFromPmDocument = (
  pmDocument: Record<string, unknown>
): string[] => {
  const ids = new Set<string>();

  const visit = (node: unknown): void => {
    if (!isRecord(node)) {
      return;
    }
    const { type } = node;
    if (type === "image") {
      const { attrs: attributes } = node;
      if (isRecord(attributes) && typeof attributes.assetId === "string") {
        ids.add(attributes.assetId);
      }
    }
    const { content } = node;
    if (Array.isArray(content)) {
      for (const child of content) {
        visit(child);
      }
    }
  };

  visit(pmDocument);
  return [...ids];
};
