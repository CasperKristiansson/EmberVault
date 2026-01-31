import MiniSearch from "minisearch";
import type { NoteDocumentFile } from "../storage/types";

export type SearchDocument = {
  id: string;
  title: string;
  content: string;
  tagIds: string[];
  folderId: string | null;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  isTemplate: boolean;
};

export type SearchQuery = {
  query: string;
  fuzzy?: number;
  prefix?: boolean;
  filter?: (result: SearchResult) => boolean;
};

export type SearchResult = {
  id: string;
  score: number;
  terms: string[];
  match?: Record<string, string[]>;
} & Partial<SearchDocument>;

export type SearchIndexChange =
  | {
      type: "upsert";
      note: NoteDocumentFile;
    }
  | {
      type: "remove";
      noteId: string;
    };

const searchFields: (keyof Pick<SearchDocument, "title" | "content">)[] = [
  "title",
  "content",
];

const searchStoreFields: (keyof SearchDocument)[] = [
  "title",
  "content",
  "tagIds",
  "folderId",
  "favorite",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isTemplate",
];

const searchOptions = {
  fields: searchFields,
  storeFields: searchStoreFields,
  idField: "id",
};

const createSearchEngine = (): MiniSearch<SearchDocument> =>
  new MiniSearch<SearchDocument>(searchOptions);

export const toSearchDocument = (note: NoteDocumentFile): SearchDocument => {
  const derivedText = note.derived?.plainText ?? "";
  const resolvedTitle = note.title.trim();
  return {
    id: note.id,
    title: resolvedTitle,
    content: derivedText,
    tagIds: note.tagIds,
    folderId: note.folderId,
    favorite: note.favorite,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    deletedAt: note.deletedAt,
    isTemplate: note.isTemplate ?? false,
  };
};

export const buildSearchIndex = (
  notes: NoteDocumentFile[]
): MiniSearch<SearchDocument> => {
  const index = createSearchEngine();
  if (notes.length > 0) {
    index.addAll(notes.map(toSearchDocument));
  }
  return index;
};

export const serializeSearchIndex = (
  index: MiniSearch<SearchDocument>
): string => JSON.stringify(index);

export const loadSearchIndex = (snapshot: string): MiniSearch<SearchDocument> =>
  MiniSearch.loadJSON(snapshot, searchOptions);

const sortSearchResults = (results: SearchResult[]): SearchResult[] =>
  results.toSorted((first, second) => {
    if (first.score !== second.score) {
      return second.score - first.score;
    }
    const firstUpdated =
      typeof first.updatedAt === "number" ? first.updatedAt : 0;
    const secondUpdated =
      typeof second.updatedAt === "number" ? second.updatedAt : 0;
    if (firstUpdated !== secondUpdated) {
      return secondUpdated - firstUpdated;
    }
    return first.id.localeCompare(second.id);
  });

export const querySearchIndex = (
  index: MiniSearch<SearchDocument>,
  parameters: SearchQuery
): SearchResult[] => {
  const trimmed = parameters.query.trim();
  if (!trimmed) {
    return [];
  }
  const results = index.search(trimmed, {
    fuzzy: parameters.fuzzy ?? 0.2,
    prefix: parameters.prefix ?? true,
    filter: parameters.filter,
  }) as SearchResult[];
  return sortSearchResults(results);
};

export const updateSearchIndex = (
  index: MiniSearch<SearchDocument>,
  change: SearchIndexChange
): MiniSearch<SearchDocument> => {
  if (change.type === "remove") {
    index.discard(change.noteId);
    return index;
  }
  const { note } = change;
  if (note.deletedAt) {
    index.discard(note.id);
    return index;
  }
  const document = toSearchDocument(note);
  if (index.has(document.id)) {
    index.replace(document);
    return index;
  }
  index.add(document);
  return index;
};
