const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const escapeRegExp = (value: string): string =>
  value.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\\$&`);

type Replacement = { raw: string; targetId: string };

const replaceTextNode = (text: string, replacements: Replacement[]): string => {
  let next = text;
  for (const replacement of replacements) {
    const raw = replacement.raw.trim();
    if (!raw) {
      continue;
    }
    const pattern = new RegExp(
      String.raw`\\[\\[\\s*${escapeRegExp(raw)}\\s*\\]\\]`,
      "gu"
    );
    next = next.replaceAll(pattern, `[[${replacement.targetId}]]`);
  }
  return next;
};

export const replaceWikiLinksInPmDoc = (input: {
  pmDoc: Record<string, unknown>;
  replacements: Replacement[];
}): Record<string, unknown> => {
  if (input.replacements.length === 0) {
    return input.pmDoc;
  }

  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      return node.map(visit);
    }
    if (!isRecord(node)) {
      return node;
    }
    const next: Record<string, unknown> = { ...node };
    if (typeof next.text === "string") {
      next.text = replaceTextNode(next.text, input.replacements);
    }
    if (Array.isArray(next.content)) {
      next.content = next.content.map(visit) as unknown as Record<string, unknown>[];
    }
    return next;
  };

  return visit(input.pmDoc) as Record<string, unknown>;
};

