<script lang="ts">
  import type { SearchResult } from "$lib/core/search/minisearch";

  export let result: SearchResult;
  export let snippet = "";
  export let tagLabels: string[] = [];
  export let onSelect: (noteId: string) => void = () => {};

  const handleClick = (): void => {
    onSelect(result.id);
  };

  $: resolvedTitle = result.title?.trim() ? result.title : "Untitled";
  $: visibleTags = tagLabels.slice(0, 3);
</script>

<button
  class="search-row"
  type="button"
  on:click={handleClick}
  data-testid={`search-result-${result.id}`}
>
  <div class="search-row-main">
    <div class="search-row-title">{resolvedTitle}</div>
    <div class="search-row-snippet">{snippet}</div>
  </div>
  {#if visibleTags.length > 0}
    <div class="search-row-tags" aria-label="Tags">
      {#each visibleTags as tag (tag)}
        <span class="search-row-tag">{tag}</span>
      {/each}
    </div>
  {/if}
</button>

<style>
  .search-row {
    height: var(--note-row-height);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 12px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-0);
    cursor: pointer;
    text-align: left;
  }

  .search-row:hover {
    background: var(--bg-3);
  }

  .search-row-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1;
  }

  .search-row-title {
    font-size: 13px;
    color: var(--text-0);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .search-row-snippet {
    font-size: 12px;
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .search-row-tags {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    flex-shrink: 0;
  }

  .search-row-tag {
    font-size: 12px;
    color: var(--text-1);
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
  }
</style>
