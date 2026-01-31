import {
  buildSearchIndex,
  loadSearchIndex,
  querySearchIndex,
  serializeSearchIndex,
} from "$lib/core/search/minisearch";
import type {
  SearchDocument,
  SearchQuery,
  SearchResult,
} from "$lib/core/search/minisearch";
import type MiniSearch from "minisearch";
import type { NoteDocumentFile, StorageAdapter } from "$lib/core/storage/types";

export type SearchIndexState = {
  index: MiniSearch<SearchDocument>;
};

export const hydrateSearchIndex = async (
  adapter: StorageAdapter,
  projectId: string,
  notes: NoteDocumentFile[]
): Promise<SearchIndexState> => {
  const snapshot = await adapter.readSearchIndex(projectId);
  if (snapshot) {
    return { index: loadSearchIndex(snapshot) };
  }
  const index = buildSearchIndex(notes);
  await adapter.writeSearchIndex(projectId, serializeSearchIndex(index));
  return { index };
};

export const persistSearchIndex = async (
  adapter: StorageAdapter,
  projectId: string,
  index: MiniSearch<SearchDocument>
): Promise<void> => {
  await adapter.writeSearchIndex(projectId, serializeSearchIndex(index));
};

export const querySearch = (
  index: MiniSearch<SearchDocument>,
  parameters: SearchQuery
): SearchResult[] => querySearchIndex(index, parameters);
