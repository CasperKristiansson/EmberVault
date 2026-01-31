import type { NoteIndexEntry } from "$lib/core/storage/types";

type AdjacencyMap = Map<string, Set<string>>;

type GraphIndex = {
  adjacency: AdjacencyMap;
  idSet: Set<string>;
};

const emptySet: ReadonlySet<string> = new Set();

const resolveOutgoingTargets = (
  note: NoteIndexEntry,
  idSet: Set<string>
): string[] => {
  const outgoing = note.linkOutgoing ?? [];
  const targets: string[] = [];
  for (const target of outgoing) {
    if (idSet.has(target)) {
      targets.push(target);
    }
  }
  return targets;
};

const addNeighbor = (
  adjacency: AdjacencyMap,
  source: string,
  target: string
): void => {
  const neighbors = adjacency.get(source) ?? new Set<string>();
  neighbors.add(target);
  adjacency.set(source, neighbors);
};

const buildAdjacency = (notes: NoteIndexEntry[]): GraphIndex => {
  const activeNotes: NoteIndexEntry[] = [];
  for (const note of notes) {
    if (note.deletedAt === null) {
      activeNotes.push(note);
    }
  }
  const idSet = new Set<string>();
  for (const note of activeNotes) {
    idSet.add(note.id);
  }
  const adjacency: AdjacencyMap = new Map();

  for (const note of activeNotes) {
    const outgoingTargets = resolveOutgoingTargets(note, idSet);
    for (const target of outgoingTargets) {
      addNeighbor(adjacency, note.id, target);
      addNeighbor(adjacency, target, note.id);
    }
    if (!adjacency.has(note.id)) {
      adjacency.set(note.id, new Set());
    }
  }

  return { adjacency, idSet };
};

const expandFrontier = (
  adjacency: AdjacencyMap,
  frontier: Set<string>,
  visited: Set<string>
): Set<string> => {
  const nextFrontier = new Set<string>();
  for (const nodeId of frontier) {
    const neighbors = adjacency.get(nodeId) ?? emptySet;
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        nextFrontier.add(neighbor);
      }
    }
  }
  return nextFrontier;
};

const walkNeighborhood = (
  adjacency: AdjacencyMap,
  centerId: string,
  depth: number
): Set<string> => {
  const visited = new Set<string>([centerId]);
  let frontier = new Set<string>([centerId]);

  for (let currentDepth = 0; currentDepth < depth; currentDepth += 1) {
    const nextFrontier = expandFrontier(adjacency, frontier, visited);
    if (nextFrontier.size === 0) {
      break;
    }
    frontier = nextFrontier;
  }

  return visited;
};

export const filterNotesByTag = (
  notes: NoteIndexEntry[],
  tagId: string | null
): NoteIndexEntry[] => {
  if (!tagId || tagId === "all") {
    return notes;
  }
  const filtered: NoteIndexEntry[] = [];
  for (const note of notes) {
    if (note.tagIds.includes(tagId)) {
      filtered.push(note);
    }
  }
  return filtered;
};

export const resolveNeighborhoodNoteIds = (
  notes: NoteIndexEntry[],
  centerId: string,
  depth: number
): Set<string> => {
  const { adjacency, idSet } = buildAdjacency(notes);
  if (!idSet.has(centerId)) {
    return new Set();
  }
  return walkNeighborhood(adjacency, centerId, depth);
};
