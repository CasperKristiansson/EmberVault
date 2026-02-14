type PMNode = {
  type?: unknown;
  attrs?: unknown;
  content?: unknown;
  text?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isPmNode = (value: unknown): value is PMNode => isRecord(value);

const getNodeContent = (node: PMNode): PMNode[] => {
  const raw = node.content;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(isPmNode);
};

const collectText = (node: PMNode): string => {
  const text = typeof node.text === "string" ? node.text : "";
  const children = getNodeContent(node).map(collectText).join("");
  return text + children;
};

export const extractTitleFromPmDocument = (
  pmDocument: Record<string, unknown>
): string => {
  const rawContent: unknown = pmDocument.content;
  if (!Array.isArray(rawContent) || rawContent.length === 0) {
    return "";
  }
  const nodes = rawContent as unknown[];
  const [first] = nodes;
  if (!isPmNode(first)) {
    return "";
  }
  return collectText(first).trim();
};

export const splitEditorTextIntoTitleAndBody = (
  text: string
): { title: string; body: string } => {
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const [first, ...rest] = normalized.split("\n");
  return {
    title: first.trim(),
    body: rest.join("\n").replace(/^\n+/u, ""),
  };
};

export const ensureTitleHeadingInPmDocument = (input: {
  pmDocument: Record<string, unknown>;
  title: string;
}): Record<string, unknown> => {
  const { pmDocument, title } = input;
  const rawContent: unknown = pmDocument.content;
  const content = Array.isArray(rawContent) ? rawContent.filter(isPmNode) : [];

  const [first] = content;
  const isHeading1 =
    Boolean(first) &&
    first.type === "heading" &&
    isRecord(first.attrs) &&
    first.attrs.level === 1;

  if (isHeading1) {
    return pmDocument;
  }

  const heading: PMNode = {
    type: "heading",
    attrs: { level: 1 },
    content: title.trim()
      ? [
          {
            type: "text",
            text: title.trim(),
          },
        ]
      : [],
  };

  const nextContent: PMNode[] = [heading, ...content];
  if (nextContent.length === 1) {
    nextContent.push({ type: "paragraph", content: [] });
  }

  return {
    ...pmDocument,
    type: "doc",
    content: nextContent,
  };
};

export const setTitleInPmDocument = (input: {
  pmDocument: Record<string, unknown>;
  title: string;
}): Record<string, unknown> => {
  const ensured = ensureTitleHeadingInPmDocument(input);
  const rawContent: unknown = ensured.content;
  const content = Array.isArray(rawContent) ? rawContent.filter(isPmNode) : [];
  if (content.length === 0) {
    return ensured;
  }
  const [first, ...rest] = content;
  const nextHeading: PMNode = {
    ...first,
    type: "heading",
    attrs: { level: 1 },
    content: input.title.trim()
      ? [
          {
            type: "text",
            text: input.title.trim(),
          },
        ]
      : [],
  };
  return {
    ...ensured,
    type: "doc",
    content: [nextHeading, ...rest],
  };
};
