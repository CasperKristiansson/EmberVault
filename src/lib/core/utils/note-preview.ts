const maxPreviewLength = 160;

export const resolveNotePreview = (plainText?: string): string | null => {
  if (typeof plainText !== "string") {
    return null;
  }
  const collapsed = plainText.replaceAll(/\s+/gu, " ").trim();
  if (collapsed.length === 0) {
    return null;
  }
  return collapsed.length > maxPreviewLength
    ? `${collapsed.slice(0, maxPreviewLength).trim()}…`
    : collapsed;
};
