import { sanitizePathSegment } from "$lib/core/utils/vault-export";

type PmNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PmNode[];
  text?: string;
};

const normalizeNewlines = (input: string): string =>
  input.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

const stripFrontmatter = (markdown: string): string => {
  const normalized = normalizeNewlines(markdown);
  if (!normalized.startsWith("---\n")) {
    return normalized;
  }
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) {
    return normalized;
  }
  return normalized.slice(end + "\n---\n".length);
};

const baseNameWithoutExtension = (fileName: string): string => {
  const trimmed = fileName.trim();
  const lastSlash = Math.max(
    trimmed.lastIndexOf("/"),
    trimmed.lastIndexOf("\\")
  );
  const base = lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;
  if (base.toLowerCase().endsWith(".md")) {
    return base.slice(0, -3);
  }
  return base;
};

const parseTitleFromFirstHeading = (
  markdown: string
): {
  title: string | null;
  titleLineIndex: number | null;
  lines: string[];
} => {
  const normalized = stripFrontmatter(markdown);
  const lines = normalizeNewlines(normalized).split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (line.length === 0) {
      // Skip leading whitespace.
    } else if (line.startsWith("# ")) {
      return { title: line.slice(2).trim(), titleLineIndex: index, lines };
    } else {
      return { title: null, titleLineIndex: null, lines };
    }
  }
  return { title: null, titleLineIndex: null, lines };
};

const createTextWithHardBreaks = (lines: string[]): PmNode[] => {
  const result: PmNode[] = [];
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trimEnd();
    if (trimmed.length > 0) {
      result.push({ type: "text", text: trimmed });
    }
    const isLast = index === lines.length - 1;
    if (!isLast) {
      result.push({ type: "hardBreak" });
    }
  }
  return result;
};

const createParagraph = (lines: string[]): PmNode => ({
  type: "paragraph",
  content: createTextWithHardBreaks(lines),
});

const createHeading = (level: number, text: string): PmNode => ({
  type: "heading",
  attrs: { level },
  content: text.trim().length > 0 ? [{ type: "text", text: text.trim() }] : [],
});

const createCodeBlock = (code: string, language: string | null): PmNode => ({
  type: "codeBlock",
  attrs: { language },
  content: code.trim().length > 0 ? [{ type: "text", text: code }] : [],
});

const stripBlockQuotePrefix = (line: string): string => {
  if (line.startsWith("> ")) {
    return line.slice(2);
  }
  if (line.startsWith(">")) {
    return line.slice(1);
  }
  return line;
};

const extractPlainText = (lines: string[]): string =>
  lines.map(stripBlockQuotePrefix).join("\n").trim();

const parseHeadingLine = (
  line: string
): { level: number; text: string } | null => {
  let count = 0;
  while (count < line.length && line[count] === "#") {
    count += 1;
  }
  if (count < 2 || count > 6) {
    return null;
  }
  const after = line[count] ?? "";
  if (after !== " ") {
    return null;
  }
  const text = line.slice(count + 1).trim();
  return text.length > 0 ? { level: count, text } : null;
};

const parseFenceLanguage = (line: string): string | null => {
  const trimmed = line.trim();
  if (!trimmed.startsWith("```")) {
    return null;
  }
  const language = trimmed.slice(3).trim();
  return language.length > 0 ? language : null;
};

type ListLineParse = {
  kind: "bullet" | "ordered";
  text: string;
  start?: number;
};

/* eslint-disable sonarjs/cyclomatic-complexity */
const parseListLine = (line: string): ListLineParse | null => {
  const trimmedStart = line.trimStart();
  const bulletMarker = trimmedStart.charAt(0);
  const hasBulletPrefix =
    (bulletMarker === "-" || bulletMarker === "*" || bulletMarker === "+") &&
    trimmedStart[1] === " ";
  if (hasBulletPrefix) {
    const text = trimmedStart.slice(2).trim();
    if (text.length === 0) {
      return null;
    }
    return {
      kind: "bullet",
      text,
    };
  }

  let digitLength = 0;
  while (
    digitLength < trimmedStart.length &&
    trimmedStart.charAt(digitLength) >= "0" &&
    trimmedStart.charAt(digitLength) <= "9"
  ) {
    digitLength += 1;
  }
  const hasOrderedPrefix =
    digitLength > 0 &&
    trimmedStart[digitLength] === "." &&
    trimmedStart[digitLength + 1] === " ";
  if (!hasOrderedPrefix) {
    return null;
  }
  const text = trimmedStart.slice(digitLength + 2).trim();
  if (text.length === 0) {
    return null;
  }
  return {
    kind: "ordered",
    start: Number.parseInt(trimmedStart.slice(0, digitLength), 10),
    text,
  };
};
/* eslint-enable sonarjs/cyclomatic-complexity */

const createListNode = (
  kind: "bullet" | "ordered",
  items: string[],
  orderedStart: number | null
): PmNode => {
  // eslint-disable-next-line sonarjs/arrow-function-convention
  const listItems = items.map((text) => ({
    type: "listItem",
    content: [createParagraph([text])],
  }));
  if (kind === "ordered") {
    return {
      type: "orderedList",
      attrs: { start: orderedStart ?? 1 },
      content: listItems,
    };
  }
  return {
    type: "bulletList",
    content: listItems,
  };
};

const buildContentLines = (
  lines: string[],
  titleLineIndex: number | null
): string[] => {
  if (titleLineIndex === null) {
    return [...lines];
  }
  const result: string[] = [];
  for (const [index, line] of lines.entries()) {
    if (index !== titleLineIndex) {
      result.push(line);
    }
  }
  return result;
};

/* eslint-disable sonarjs/cognitive-complexity, sonarjs/cyclomatic-complexity, sonarjs/nested-control-flow, sonarjs/too-many-break-or-continue-in-loop, no-continue, max-depth, sonarjs/updated-loop-counter */
const parseContentLines = (
  contentLines: string[]
): {
  pmBlocks: PmNode[];
  plainTextBlocks: string[];
} => {
  const pmBlocks: PmNode[] = [];
  const plainTextBlocks: string[] = [];
  const paragraphLines: string[] = [];

  const flushParagraph = (): void => {
    if (paragraphLines.length > 0) {
      pmBlocks.push(createParagraph(paragraphLines));
      plainTextBlocks.push(extractPlainText(paragraphLines));
      paragraphLines.length = 0;
    }
  };

  let inFence = false;
  let fenceLines: string[] = [];
  let fenceLanguage: string | null = null;

  for (let index = 0; index < contentLines.length; index += 1) {
    const line = contentLines[index] ?? "";
    const isFence = line.trim().startsWith("```");
    const fence = parseFenceLanguage(line);
    if (isFence) {
      if (inFence) {
        flushParagraph();
        const code = fenceLines.join("\n");
        pmBlocks.push(createCodeBlock(code, fenceLanguage));
        plainTextBlocks.push(code.trim());
        fenceLines = [];
        fenceLanguage = null;
        inFence = false;
      } else {
        flushParagraph();
        fenceLanguage = fence;
        inFence = true;
      }
    } else if (inFence) {
      fenceLines.push(line);
    } else if (line.trim().length === 0) {
      flushParagraph();
    } else {
      const trimmed = line.trim();
      const heading = parseHeadingLine(trimmed);
      if (heading) {
        flushParagraph();
        pmBlocks.push(createHeading(heading.level, heading.text));
        plainTextBlocks.push(heading.text);
      } else {
        const firstListItem = parseListLine(trimmed);
        if (!firstListItem) {
          paragraphLines.push(stripBlockQuotePrefix(line));
          continue;
        }
        flushParagraph();

        const listItems: string[] = [firstListItem.text];
        const orderedStart =
          firstListItem.kind === "ordered" ? (firstListItem.start ?? 1) : null;
        let consumedLines = 0;
        for (
          let nextIndex = index + 1;
          nextIndex < contentLines.length;
          nextIndex += 1
        ) {
          const candidateLine = contentLines[nextIndex] ?? "";
          if (candidateLine.trim().length === 0) {
            break;
          }
          const parsedCandidate = parseListLine(candidateLine);
          if (parsedCandidate?.kind !== firstListItem.kind) {
            break;
          }
          listItems.push(parsedCandidate.text);
          consumedLines += 1;
        }
        index += consumedLines;

        pmBlocks.push(
          createListNode(firstListItem.kind, listItems, orderedStart)
        );
        plainTextBlocks.push(listItems.join("\n"));
      }
    }
  }

  if (inFence) {
    flushParagraph();
    const code = fenceLines.join("\n");
    pmBlocks.push(createCodeBlock(code, fenceLanguage));
    plainTextBlocks.push(code.trim());
  } else {
    flushParagraph();
  }

  if (pmBlocks.length === 0) {
    pmBlocks.push({ type: "paragraph", content: [] });
  }

  return { pmBlocks, plainTextBlocks };
};
/* eslint-enable sonarjs/cognitive-complexity, sonarjs/cyclomatic-complexity, sonarjs/nested-control-flow, sonarjs/too-many-break-or-continue-in-loop, no-continue, max-depth, sonarjs/updated-loop-counter */

type MarkdownImportResult = {
  title: string;
  plainText: string;
  pmDocument: Record<string, unknown>;
};

export const importMarkdownToNote = (input: {
  fileName: string;
  markdown: string;
}): MarkdownImportResult => {
  const { title, titleLineIndex, lines } = parseTitleFromFirstHeading(
    input.markdown
  );
  const fallbackTitle = sanitizePathSegment(
    baseNameWithoutExtension(input.fileName),
    "Untitled"
  );
  const resolvedTitle = sanitizePathSegment(title ?? "", fallbackTitle);

  const contentLines = buildContentLines(lines, titleLineIndex);
  const { pmBlocks, plainTextBlocks } = parseContentLines(contentLines);

  const pmDocument: Record<string, unknown> = {
    type: "doc",
    content: [createHeading(1, resolvedTitle), ...pmBlocks],
  };

  const plainText = plainTextBlocks
    /* eslint-disable sonarjs/arrow-function-convention */
    .filter((block) => block.trim().length > 0)
    /* eslint-enable sonarjs/arrow-function-convention */
    .join("\n\n")
    .trim();

  return {
    title: resolvedTitle,
    plainText,
    pmDocument,
  };
};
