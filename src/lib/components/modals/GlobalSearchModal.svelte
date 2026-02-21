<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { SvelteDate } from "svelte/reactivity";
  import { motion } from "@motionone/svelte";
  import { X } from "lucide-svelte";
  import NoteListVirtualized from "$lib/components/notes/NoteListVirtualized.svelte";
  import SearchResultRow from "$lib/components/search/SearchResultRow.svelte";
  import { createDebouncedTask } from "$lib/core/utils/debounce";
  import {
    getChildFolderIds,
    getRootFolderIds,
  } from "$lib/core/utils/folder-tree";
  import type { SearchResult } from "$lib/core/search/minisearch";
  import type { Vault } from "$lib/core/storage/types";
  import { querySearch } from "$lib/state/search.store";
  import type { SearchIndexState } from "$lib/state/search.store";
  import { prefersReducedMotion } from "$lib/state/motion.store";

  export let vault: Vault | null = null;
  export let searchState: SearchIndexState | null = null;
  export let searchLoading = false;
  export let onClose: () => void = () => {};
  export let onOpenNote: (noteId: string) => void | Promise<void> = async () => {};

  let query = "";
  let results: SearchResult[] = [];
  let inputElement: HTMLInputElement | null = null;

  let selectedFolderId = "all";
  let selectedTagId = "all";
  let favoritesOnly = false;
  let createdFrom = "";
  let createdTo = "";
  let updatedFrom = "";
  let updatedTo = "";
  let folderOptions: FolderOption[] = [];
  let tagOptions: Array<{ id: string; name: string }> = [];
  let hasActiveFilters = false;

  type FolderOption = {
    id: string;
    label: string;
  };

  const buildFolderOptions = (currentVault: Vault | null): FolderOption[] => {
    if (!currentVault) {
      return [];
    }
    const folders = currentVault.folders;
    const rootIds = getRootFolderIds(folders);
    const options: FolderOption[] = [];
    const traverse = (folderId: string, depth: number): void => {
      const folder = folders[folderId];
      if (!folder) {
        return;
      }
      const prefix = depth > 0 ? `${"- ".repeat(depth)}` : "";
      options.push({
        id: folder.id,
        label: `${prefix}${folder.name}`,
      });
      const children = getChildFolderIds(folderId, folders);
      for (const childId of children) {
        traverse(childId, depth + 1);
      }
    };
    for (const rootId of rootIds) {
      traverse(rootId, 0);
    }
    return options;
  };

  const parseDateStart = (value: string): number | null => {
    if (!value) {
      return null;
    }
    const date = new SvelteDate(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  };

  const parseDateEnd = (value: string): number | null => {
    if (!value) {
      return null;
    }
    const date = new SvelteDate(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    date.setHours(23, 59, 59, 999);
    return date.getTime();
  };

  const matchesFilters = (result: SearchResult): boolean => {
    if (selectedFolderId !== "all" && result.folderId !== selectedFolderId) {
      return false;
    }
    if (selectedTagId !== "all") {
      const tags = result.tagIds ?? [];
      if (!tags.includes(selectedTagId)) {
        return false;
      }
    }
    if (favoritesOnly && !result.favorite) {
      return false;
    }

    const createdStart = parseDateStart(createdFrom);
    const createdEnd = parseDateEnd(createdTo);
    const updatedStart = parseDateStart(updatedFrom);
    const updatedEnd = parseDateEnd(updatedTo);
    const createdAt = typeof result.createdAt === "number" ? result.createdAt : 0;
    const updatedAt = typeof result.updatedAt === "number" ? result.updatedAt : 0;

    if (createdStart !== null && createdAt < createdStart) {
      return false;
    }
    if (createdEnd !== null && createdAt > createdEnd) {
      return false;
    }
    if (updatedStart !== null && updatedAt < updatedStart) {
      return false;
    }
    if (updatedEnd !== null && updatedAt > updatedEnd) {
      return false;
    }
    return true;
  };

  const runQuery = (): void => {
    if (!searchState) {
      results = [];
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) {
      results = [];
      return;
    }
    results = querySearch(searchState.index, {
      query: trimmed,
      fuzzy: 0.2,
      prefix: true,
      filter: matchesFilters,
    });
  };

  const debouncedQuery = createDebouncedTask(async () => {
    runQuery();
  }, 50);

  const scheduleQuery = (): void => {
    if (!query.trim()) {
      debouncedQuery.cancel();
      results = [];
      return;
    }
    debouncedQuery.schedule();
  };

  const resetFilters = (): void => {
    selectedFolderId = "all";
    selectedTagId = "all";
    favoritesOnly = false;
    createdFrom = "";
    createdTo = "";
    updatedFrom = "";
    updatedTo = "";
  };

  const handleSelectNote = async (noteId: string): Promise<void> => {
    await onOpenNote(noteId);
    onClose();
  };

  const buildSnippet = (content: string, terms: string[]): string => {
    const normalized = content.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return "";
    }
    if (terms.length === 0) {
      return normalized.slice(0, 120);
    }
    const lower = normalized.toLowerCase();
    for (const term of terms) {
      const index = lower.indexOf(term.toLowerCase());
      if (index >= 0) {
        const start = Math.max(0, index - 48);
        const end = Math.min(normalized.length, index + term.length + 48);
        const prefix = start > 0 ? "…" : "";
        const suffix = end < normalized.length ? "…" : "";
        return `${prefix}${normalized.slice(start, end)}${suffix}`;
      }
    }
    return normalized.slice(0, 120);
  };

  const resolveTagLabels = (result: SearchResult): string[] => {
    if (!vault) {
      return [];
    }
    const tagLookup = vault.tags;
    return (result.tagIds ?? [])
      .map((tagId) => tagLookup[tagId]?.name)
      .filter((tag): tag is string => Boolean(tag));
  };

  const resolveSnippet = (result: SearchResult): string => {
    return buildSnippet(result.content ?? "", result.terms ?? []);
  };

  $: folderOptions = buildFolderOptions(vault);
  $: tagOptions = vault ? Object.values(vault.tags) : [];
  $: hasActiveFilters =
    selectedFolderId !== "all" ||
    selectedTagId !== "all" ||
    favoritesOnly ||
    Boolean(createdFrom) ||
    Boolean(createdTo) ||
    Boolean(updatedFrom) ||
    Boolean(updatedTo);

  $: {
    searchState;
    query;
    selectedFolderId;
    selectedTagId;
    favoritesOnly;
    createdFrom;
    createdTo;
    updatedFrom;
    updatedTo;
    scheduleQuery();
  }

  onMount(async () => {
    await tick();
    inputElement?.focus();
  });

  onDestroy(() => {
    debouncedQuery.cancel();
  });
</script>

<div
  class="modal-overlay"
  data-testid="global-search-modal"
  transition:motion={{ preset: "fade", reducedMotion: $prefersReducedMotion }}
>
  <div
    class="modal-panel"
    role="dialog"
    aria-modal="true"
    transition:motion={{ preset: "modal", reducedMotion: $prefersReducedMotion }}
  >
    <header class="modal-header">
      <div class="modal-title">Search</div>
      <button
        class="icon-button"
        type="button"
        aria-label="Close search"
        on:click={onClose}
      >
        <X aria-hidden="true" size={16} />
      </button>
    </header>

    <div class="search-input-row">
      <input
        class="search-input"
        type="search"
        placeholder="Search notes..."
        bind:this={inputElement}
        value={query}
        on:input={(event) => {
          const target = event.currentTarget;
          if (target instanceof HTMLInputElement) {
            query = target.value;
          }
        }}
        aria-label="Search notes"
      />
    </div>

    {#if searchLoading && !searchState}
      <div class="indexing-note">Indexing notes...</div>
    {/if}

    <div class="filter-grid">
      <label class="filter-field">
        <span class="filter-label">Folder</span>
        <select
          class="filter-select"
          value={selectedFolderId}
          on:change={(event) => {
            const target = event.currentTarget;
            if (target instanceof HTMLSelectElement) {
              selectedFolderId = target.value;
            }
          }}
          aria-label="Filter by folder"
        >
          <option value="all">All folders</option>
          {#each folderOptions as option (option.id)}
            <option value={option.id}>{option.label}</option>
          {/each}
        </select>
      </label>

      <label class="filter-field">
        <span class="filter-label">Tag</span>
        <select
          class="filter-select"
          value={selectedTagId}
          on:change={(event) => {
            const target = event.currentTarget;
            if (target instanceof HTMLSelectElement) {
              selectedTagId = target.value;
            }
          }}
          aria-label="Filter by tag"
        >
          <option value="all">All tags</option>
          {#each tagOptions as tag (tag.id)}
            <option value={tag.id}>{tag.name}</option>
          {/each}
        </select>
      </label>

      <label class="filter-field filter-toggle">
        <span class="filter-label">Favorites</span>
        <button
          class={`filter-chip${favoritesOnly ? " active" : ""}`}
          type="button"
          aria-pressed={favoritesOnly}
          on:click={() => (favoritesOnly = !favoritesOnly)}
        >
          {favoritesOnly ? "On" : "Off"}
        </button>
      </label>
    </div>

    <div class="filter-grid filter-dates">
      <label class="filter-field">
        <span class="filter-label">Created from</span>
        <input
          class="filter-input"
          type="date"
          value={createdFrom}
          on:input={(event) => {
            const target = event.currentTarget;
            if (target instanceof HTMLInputElement) {
              createdFrom = target.value;
            }
          }}
          aria-label="Created from date"
        />
      </label>

      <label class="filter-field">
        <span class="filter-label">Created to</span>
        <input
          class="filter-input"
          type="date"
          value={createdTo}
          on:input={(event) => {
            const target = event.currentTarget;
            if (target instanceof HTMLInputElement) {
              createdTo = target.value;
            }
          }}
          aria-label="Created to date"
        />
      </label>

      <label class="filter-field">
        <span class="filter-label">Updated from</span>
        <input
          class="filter-input"
          type="date"
          value={updatedFrom}
          on:input={(event) => {
            const target = event.currentTarget;
            if (target instanceof HTMLInputElement) {
              updatedFrom = target.value;
            }
          }}
          aria-label="Updated from date"
        />
      </label>

      <label class="filter-field">
        <span class="filter-label">Updated to</span>
        <input
          class="filter-input"
          type="date"
          value={updatedTo}
          on:input={(event) => {
            const target = event.currentTarget;
            if (target instanceof HTMLInputElement) {
              updatedTo = target.value;
            }
          }}
          aria-label="Updated to date"
        />
      </label>
    </div>

    <div class="results-header">
      <span class="results-title">Results</span>
      {#if hasActiveFilters}
        <button class="link-button" type="button" on:click={resetFilters}>
          Clear filters
        </button>
      {/if}
    </div>

    <div class="search-results" data-testid="search-results">
      {#if !searchState && searchLoading}
        <div class="results-empty">Indexing notes...</div>
      {:else if !searchState}
        <div class="results-empty">Search index unavailable.</div>
      {:else if results.length === 0}
        <div class="results-empty">No results.</div>
      {:else}
        <NoteListVirtualized
          notes={results}
          activeNoteId={null}
          onSelect={noteId => void handleSelectNote(noteId)}
        >
          <svelte:fragment
            slot="row"
            let:note
            let:onSelect
          >
            <SearchResultRow
              result={note as SearchResult}
              snippet={resolveSnippet(note as SearchResult)}
              tagLabels={resolveTagLabels(note as SearchResult)}
              onSelect={onSelect}
            />
          </svelte:fragment>
        </NoteListVirtualized>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 12px;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(10px) saturate(1.1);
    z-index: 100;
  }

  .modal-panel {
    margin-top: 48px;
    width: min(640px, 100% - 24px);
    background: var(--bg-1);
    border-radius: var(--r-lg);
    border: 1px solid var(--stroke-0);
    box-shadow: var(--shadow-panel);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    z-index: 110;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .modal-title {
    font-weight: 500;
  }

  .icon-button {
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: var(--r-md);
    border: none;
    background: transparent;
    color: var(--text-1);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .icon-button:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .icon-button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .icon-button :global(svg) {
    display: block;
  }

  .search-input-row {
    display: flex;
  }

  .search-input {
    width: 100%;
    height: 32px;
    padding: 0 12px;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-2);
    color: var(--text-0);
  }

  .search-input::placeholder {
    color: var(--text-2);
  }

  .search-input:focus {
    border-color: rgba(255, 138, 42, 0.4);
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .indexing-note {
    font-size: 12px;
    color: var(--text-2);
  }

  .filter-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .filter-dates {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .filter-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: var(--text-2);
  }

  .filter-label {
    color: var(--text-2);
  }

  .filter-select,
  .filter-input {
    height: 32px;
    padding: 0 10px;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-2);
    color: var(--text-0);
  }

  .filter-select:focus,
  .filter-input:focus {
    border-color: rgba(255, 138, 42, 0.4);
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .filter-toggle {
    align-items: flex-start;
  }

  .filter-chip {
    height: 32px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--stroke-0);
    background: transparent;
    color: var(--text-1);
    cursor: pointer;
  }

  .filter-chip.active {
    background: var(--accent-2);
    color: var(--text-0);
    border-color: transparent;
  }

  .results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    color: var(--text-2);
  }

  .results-title {
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .link-button {
    background: transparent;
    border: none;
    color: var(--accent-1);
    cursor: pointer;
    font-size: 12px;
  }

  .link-button:hover {
    color: var(--accent-0);
  }

  .search-results {
    flex: 1;
    min-height: 120px;
    max-height: 360px;
    overflow: hidden;
    --note-row-height: 52px;
    --note-row-gap: 6px;
  }

  .results-empty {
    color: var(--text-2);
    font-size: 13px;
    padding: 12px;
  }

  @media (max-width: 767px) {
    .modal-panel {
      margin-top: 16px;
      padding: 16px;
    }

    .filter-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .filter-dates {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
