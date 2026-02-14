import type { BacklinkSnippet } from "$lib/core/editor/links/backlinks";

const normalizeSnippetFragment = (
  value: string,
  options: {
    trimStart?: boolean;
    trimEnd?: boolean;
    prefix?: string;
    suffix?: string;
  } = {}
): string => {
  const collapsed = value.replaceAll(/\s+/gu, " ");
  const trimmedStart = options.trimStart ? collapsed.trimStart() : collapsed;
  const trimmed = options.trimEnd ? trimmedStart.trimEnd() : trimmedStart;
  const prefix = options.prefix ?? "";
  const suffix = options.suffix ?? "";
  if (!prefix && !suffix) {
    return trimmed;
  }
  return `${prefix}${trimmed}${suffix}`;
};

type MatchResult = { index: number; length: number; matchText: string };

const findWikiLinkRanges = (text: string): Array<{ start: number; end: number }> => {
  const ranges: Array<{ start: number; end: number }> = [];
  if (!text) {
    return ranges;
  }
  const pattern = /\[\[.*?\]\]/gu;
  let match = pattern.exec(text);
  while (match) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
    match = pattern.exec(text);
  }
  return ranges;
};

const isInsideRanges = (
  index: number,
  ranges: Array<{ start: number; end: number }>
): boolean => ranges.some((range) => index >= range.start && index < range.end);

const findFirstUnlinkedMention = (
  text: string,
  targetTitle: string
): MatchResult | null => {
  const trimmed = targetTitle.trim();
  if (!trimmed) {
    return null;
  }
  const ranges = findWikiLinkRanges(text);
  const lowerText = text.toLowerCase();
  const needle = trimmed.toLowerCase();
  let cursor = 0;
  while (cursor < lowerText.length) {
    const index = lowerText.indexOf(needle, cursor);
    if (index === -1) {
      return null;
    }
    if (!isInsideRanges(index, ranges)) {
      return { index, length: trimmed.length, matchText: text.slice(index, index + trimmed.length) };
    }
    cursor = index + needle.length;
  }
  return null;
};

export const buildUnlinkedMentionSnippet = (
  text: string,
  targetTitle: string,
  context = 36
): BacklinkSnippet | null => {
  if (!text) {
    return null;
  }
  const match = findFirstUnlinkedMention(text, targetTitle);
  if (!match) {
    return null;
  }

  const start = Math.max(0, match.index - context);
  const end = Math.min(text.length, match.index + match.length + context);
  const snippet = text.slice(start, end);
  const matchStart = match.index - start;
  const matchEnd = matchStart + match.length;

  const hasLeading = start > 0;
  const hasTrailing = end < text.length;

  const beforeRaw = snippet.slice(0, matchStart);
  const matchRaw = snippet.slice(matchStart, matchEnd);
  const afterRaw = snippet.slice(matchEnd);

  const before = normalizeSnippetFragment(beforeRaw, {
    trimStart: true,
    trimEnd: false,
    prefix: hasLeading ? "… " : "",
  });
  const matchText = normalizeSnippetFragment(matchRaw, {
    trimStart: true,
    trimEnd: true,
  });
  const after = normalizeSnippetFragment(afterRaw, {
    trimStart: false,
    trimEnd: true,
    suffix: hasTrailing ? " …" : "",
  });

  return {
    match: matchText,
    before,
    after,
  };
};

