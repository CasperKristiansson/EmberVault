import type { NoteIndexEntry } from "$lib/core/storage/types";

export type BacklinkSnippet = {
  before: string;
  match: string;
  after: string;
};

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

const escapeRegExp = (value: string): string =>
  value.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`);

type MatchResult = {
  index: number;
  length: number;
  matchText: string;
};

const findWikiLinkMatch = (
  text: string,
  target: string
): MatchResult | null => {
  const trimmedTarget = target.trim();
  if (!trimmedTarget) {
    return null;
  }
  const pattern = new RegExp(
    String.raw`\[\[\s*${escapeRegExp(trimmedTarget)}\s*\]\]`,
    "u"
  );
  const match = pattern.exec(text);
  if (!match) {
    return null;
  }
  return {
    index: match.index,
    length: match[0].length,
    matchText: match[0],
  };
};

const findFirstWikiLinkMatch = (
  text: string,
  targets: string[]
): MatchResult | null => {
  let best: MatchResult | null = null;
  for (const target of targets) {
    const candidate = findWikiLinkMatch(text, target);
    if (candidate && (!best || candidate.index < best.index)) {
      best = candidate;
    }
  }
  return best;
};

export const buildBacklinkSnippet = (
  text: string,
  targets: string[],
  context = 36
): BacklinkSnippet | null => {
  if (!text || targets.length === 0) {
    return null;
  }
  const match = findFirstWikiLinkMatch(text, targets);
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

export const resolveLinkedMentions = (
  notes: NoteIndexEntry[],
  targetId: string,
  targetTitle: string | null
): NoteIndexEntry[] => {
  if (!targetId) {
    return [];
  }
  const targets = new Set<string>();
  if (targetTitle) {
    const trimmedTitle = targetTitle.trim();
    if (trimmedTitle) {
      targets.add(trimmedTitle);
    }
  }
  targets.add(targetId);

  return notes.filter((note: NoteIndexEntry) => {
    if (note.deletedAt !== null) {
      return false;
    }
    if (note.id === targetId) {
      return false;
    }
    const outgoing = note.linkOutgoing ?? [];
    return outgoing.some((link: string) => targets.has(link));
  });
};
