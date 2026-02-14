const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const escapeRegExp = (value: string): string =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\\$&`);

type Replacement = { raw: string; targetId: string };

const replaceText = (text: string, replacements: Replacement[]): string => {
  let nextText = text;
  for (const replacement of replacements) {
    const raw = replacement.raw.trim();
    if (raw) {
      const pattern = new RegExp(
        String.raw`\[\[\s*${escapeRegExp(raw)}\s*\]\]`,
        "gu"
      );
      nextText = nextText.replaceAll(pattern, `[[${replacement.targetId}]]`);
    }
  }
  return nextText;
};

export const replaceWikiLinksInPmDocument = (input: {
  pmDocument: Record<string, unknown>;
  replacements: Replacement[];
}): Record<string, unknown> => {
  if (input.replacements.length === 0) {
    return input.pmDocument;
  }

  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      return node.map((child) => visit(child));
    }
    if (!isRecord(node)) {
      return node;
    }
    const next: Record<string, unknown> = { ...node };
    if (typeof next.text === "string") {
      next.text = replaceText(next.text, input.replacements);
    }
    if (Array.isArray(next.content)) {
      next.content = next.content.map((child) => visit(child));
    }
    return next;
  };

  const result = visit(input.pmDocument);
  return isRecord(result) ? result : input.pmDocument;
};
