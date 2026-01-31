import type { NoteIndexEntry } from "$lib/core/storage/types";

export const extractWikiLinks = (text: string): string[] => {
  if (!text) {
    return [];
  }
  const matches: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf("[[", cursor);
    const end = text.indexOf("]]", start + 2);
    if (start === -1 || end === -1) {
      cursor = text.length;
    } else {
      const raw = text.slice(start + 2, end).trim();
      if (raw.length > 0) {
        matches.push(raw);
      }
      cursor = end + 2;
    }
  }
  return matches;
};

export const resolveOutgoingLinks = (
  text: string,
  notes: NoteIndexEntry[]
): string[] => {
  const outgoing = extractWikiLinks(text);
  if (outgoing.length === 0) {
    return [];
  }

  const idSet = new Set<string>();
  const titleMap = new Map<string, string[]>();
  for (const note of notes) {
    idSet.add(note.id);
    if (note.title) {
      const existing = titleMap.get(note.title) ?? [];
      existing.push(note.id);
      titleMap.set(note.title, existing);
    }
  }

  const resolved: string[] = [];
  for (const candidate of outgoing) {
    if (idSet.has(candidate)) {
      resolved.push(candidate);
    } else {
      const matches = titleMap.get(candidate) ?? [];
      if (matches.length === 1) {
        resolved.push(matches[0]);
      } else {
        resolved.push(candidate);
      }
    }
  }
  return resolved;
};
