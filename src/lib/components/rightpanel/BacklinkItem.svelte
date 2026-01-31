<script lang="ts">
  import type { BacklinkSnippet } from "$lib/core/editor/links/backlinks";

  export let noteId: string;
  export let title: string;
  export let snippet: BacklinkSnippet | null = null;
  export let onSelect: (noteId: string) => void = () => {};

  const handleClick = (): void => {
    onSelect(noteId);
  };

  $: resolvedTitle = title?.trim() ? title : "Untitled";
</script>

<button
  class="backlink-item"
  type="button"
  on:click={handleClick}
  data-testid={`backlink-item-${noteId}`}
>
  <div class="backlink-title">{resolvedTitle}</div>
  {#if snippet}
    <div class="backlink-snippet">
      {snippet.before}<mark>{snippet.match}</mark>{snippet.after}
    </div>
  {:else}
    <div class="backlink-snippet">Snippet unavailable.</div>
  {/if}
</button>

<style>
  .backlink-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    border-radius: var(--r-sm);
    border: 1px solid var(--stroke-0);
    background: var(--bg-2);
    color: var(--text-0);
    cursor: pointer;
    text-align: left;
  }

  .backlink-item:hover {
    background: var(--bg-3);
  }

  .backlink-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-0);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .backlink-snippet {
    font-size: 12px;
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .backlink-snippet mark {
    background: var(--accent-2);
    color: var(--text-0);
    border-radius: 6px;
    padding: 0 4px;
  }
</style>
