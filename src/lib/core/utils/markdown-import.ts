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

const createCodeBlock = (code: string): PmNode => ({
  type: "codeBlock",
  attrs: { language: null },
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

const isFenceDelimiter = (line: string): boolean =>
  line.trim().startsWith("```");

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

/* eslint-disable sonarjs/cognitive-complexity */
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

  for (const rawLine of contentLines) {
    const line = rawLine;
    if (isFenceDelimiter(line)) {
      if (inFence) {
        flushParagraph();
        const code = fenceLines.join("\n");
        pmBlocks.push(createCodeBlock(code));
        plainTextBlocks.push(code.trim());
        fenceLines = [];
        inFence = false;
      } else {
        flushParagraph();
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
        paragraphLines.push(stripBlockQuotePrefix(line));
      }
    }
  }

  if (inFence) {
    flushParagraph();
    const code = fenceLines.join("\n");
    pmBlocks.push(createCodeBlock(code));
    plainTextBlocks.push(code.trim());
  } else {
    flushParagraph();
  }

  if (pmBlocks.length === 0) {
    pmBlocks.push({ type: "paragraph", content: [] });
  }

  return { pmBlocks, plainTextBlocks };
};
/* eslint-enable sonarjs/cognitive-complexity */

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
