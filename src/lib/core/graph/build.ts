import Graph from "graphology";
import type { NoteIndexEntry } from "$lib/core/storage/types";

export type GraphColorTokens = {
  baseNode: string;
  activeNode: string;
  edge: string;
};

export type GraphBuildOptions = {
  activeNoteId?: string | null;
  colors?: Partial<GraphColorTokens>;
};

const defaultColors: GraphColorTokens = {
  baseNode: "rgba(255, 255, 255, 0.5)",
  activeNode: "#FF8A2A",
  edge: "rgba(255, 255, 255, 0.12)",
};

const resolveNodeTitle = (note: NoteIndexEntry): string => {
  const trimmedTitle = note.title.trim();
  return trimmedTitle || "Untitled";
};

const resolveActiveColor = (
  noteId: string,
  activeNoteId: string | null,
  colors: GraphColorTokens
): string => (noteId === activeNoteId ? colors.activeNode : colors.baseNode);

const resolveEdgeKey = (source: string, target: string): string =>
  `${source}->${target}`;

export const buildGraph = (
  notes: NoteIndexEntry[],
  options: GraphBuildOptions = {}
): Graph => {
  const colors: GraphColorTokens = {
    ...defaultColors,
    ...options.colors,
  };
  const graph = new Graph({ type: "directed" });
  const activeNoteId = options.activeNoteId ?? null;

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

  for (const note of activeNotes) {
    const title = resolveNodeTitle(note);
    graph.addNode(note.id, {
      label: title,
      tagIds: note.tagIds,
      favorite: note.favorite,
      color: resolveActiveColor(note.id, activeNoteId, colors),
      size: 6,
      title,
    });
  }

  const addEdge = (sourceId: string, targetId: string): void => {
    if (!idSet.has(targetId)) {
      return;
    }
    const edgeKey = resolveEdgeKey(sourceId, targetId);
    if (graph.hasEdge(edgeKey)) {
      return;
    }
    graph.addEdgeWithKey(edgeKey, sourceId, targetId, {
      color: colors.edge,
      size: 1,
    });
  };

  for (const note of activeNotes) {
    const outgoing = note.linkOutgoing ?? [];
    for (const target of outgoing) {
      addEdge(note.id, target);
    }
  }

  for (const node of graph.nodes()) {
    const degree = graph.degree(node);
    const size = Math.max(5, Math.min(10, 4 + degree));
    graph.setNodeAttribute(node, "size", size);
  }

  return graph;
};
