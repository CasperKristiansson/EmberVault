import {
  buildSearchIndex,
  loadSearchIndex,
  querySearchIndex,
  serializeSearchIndex,
  updateSearchIndex,
} from "$lib/core/search/minisearch";
import type {
  SearchDocument,
  SearchIndexChange,
  SearchQuery,
  SearchResult,
} from "$lib/core/search/minisearch";
import type MiniSearch from "minisearch";
import type { NoteDocumentFile, StorageAdapter } from "$lib/core/storage/types";

export type SearchIndexState = {
  index: MiniSearch<SearchDocument>;
};

export type SearchIndexChangeInput = {
  adapter: StorageAdapter;
  state: SearchIndexState;
  change: SearchIndexChange;
};

export const hydrateSearchIndex = async (
  adapter: StorageAdapter,
  notes: NoteDocumentFile[]
): Promise<SearchIndexState> => {
  const snapshot = await adapter.readSearchIndex();
  if (snapshot) {
    return { index: loadSearchIndex(snapshot) };
  }
  const index = buildSearchIndex(notes);
  await adapter.writeSearchIndex(serializeSearchIndex(index));
  return { index };
};

export const persistSearchIndex = async (
  adapter: StorageAdapter,
  index: MiniSearch<SearchDocument>
): Promise<void> => {
  await adapter.writeSearchIndex(serializeSearchIndex(index));
};

export const applySearchIndexChange = async ({
  adapter,
  state,
  change,
}: SearchIndexChangeInput): Promise<SearchIndexState> => {
  const updatedIndex = updateSearchIndex(state.index, change);
  await persistSearchIndex(adapter, updatedIndex);
  return { index: updatedIndex };
};

export const querySearch = (
  index: MiniSearch<SearchDocument>,
  parameters: SearchQuery
): SearchResult[] => querySearchIndex(index, parameters);
