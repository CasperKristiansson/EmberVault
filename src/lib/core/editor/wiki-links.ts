export type WikiLinkCandidate = {
  id: string;
  title: string;
};

const normalize = (value: string): string => value.trim().toLowerCase();

export const resolveWikiLinkTitle = (title: string): string =>
  title.trim() || "Untitled";

export const filterWikiLinkCandidates = (
  candidates: WikiLinkCandidate[],
  query: string
): WikiLinkCandidate[] => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return candidates;
  }
  const matches: WikiLinkCandidate[] = [];
  for (const candidate of candidates) {
    const resolvedTitle = resolveWikiLinkTitle(candidate.title).toLowerCase();
    if (
      resolvedTitle.includes(normalizedQuery) ||
      candidate.id.toLowerCase().includes(normalizedQuery)
    ) {
      matches.push(candidate);
    }
  }
  return matches;
};

export const buildWikiLinkInsertText = (candidate: WikiLinkCandidate): string =>
  `[[${candidate.id}]]`;
