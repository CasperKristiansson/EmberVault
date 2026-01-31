<script lang="ts">
  import {
    resolveWikiLinkTitle,
    type WikiLinkCandidate,
  } from "$lib/core/editor/wiki-links";

  export let open = false;
  export let position: { x: number; y: number } | null = null;
  export let items: WikiLinkCandidate[] = [];
  export let selectedIndex = 0;
  export let element: HTMLDivElement | null = null;
  export let onSelect: (item: WikiLinkCandidate) => void = () => {};
  export let onHighlight: (index: number) => void = () => {};
</script>

{#if open && position}
  <div
    class="wiki-link-menu"
    bind:this={element}
    data-testid="wiki-link-menu"
    role="listbox"
    style={`left:${position.x}px; top:${position.y}px;`}
  >
    {#each items as item, index (item.id)}
      <button
        class="wiki-link-item"
        class:active={index === selectedIndex}
        type="button"
        role="option"
        aria-selected={index === selectedIndex}
        data-testid={`wiki-link-item-${item.id}`}
        on:click={() => onSelect(item)}
        on:mouseenter={() => onHighlight(index)}
      >
        <span class="title">{resolveWikiLinkTitle(item.title)}</span>
        <span class="meta">{item.id}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .wiki-link-menu {
    position: fixed;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 240px;
    max-height: 320px;
    overflow-y: auto;
    padding: 8px;
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-popover);
  }

  .wiki-link-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 10px;
    border-radius: var(--r-sm);
    border: none;
    background: transparent;
    color: var(--text-0);
    text-align: left;
    cursor: pointer;
  }

  .wiki-link-item.active,
  .wiki-link-item:hover {
    background: var(--bg-3);
  }

  .title {
    font-size: 13px;
    line-height: 1.2;
  }

  .meta {
    font-size: 11px;
    color: var(--text-2);
  }
</style>
