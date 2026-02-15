<script lang="ts">
  import type { SlashMenuItem } from "$lib/core/editor/slash-menu";

  export let open = false;
  export let position: { x: number; y: number } | null = null;
  export let items: SlashMenuItem[] = [];
  export let selectedIndex = 0;
  export let element: HTMLDivElement | null = null;
  export let onSelect: (id: SlashMenuItem["id"]) => void = () => {};
  export let onHighlight: (index: number) => void = () => {};
</script>

{#if open && position}
  <div
    class="slash-menu"
    bind:this={element}
    data-testid="slash-menu"
    role="listbox"
    style={`left:${position.x}px; top:${position.y}px;`}
  >
    {#each items as item, index (item.id)}
      <button
        class="slash-menu-item"
        class:active={index === selectedIndex}
        type="button"
        role="option"
        aria-selected={index === selectedIndex}
        aria-disabled={!item.enabled}
        data-testid={`slash-menu-item-${item.id}`}
        disabled={!item.enabled}
        on:click|stopPropagation={() => item.enabled && onSelect(item.id)}
        on:mouseenter={() => item.enabled && onHighlight(index)}
      >
        <span class="label">{item.label}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .slash-menu {
    position: fixed;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 220px;
    max-height: 320px;
    overflow-y: auto;
    padding: 8px;
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-popover);
  }

  .slash-menu-item {
    height: 32px;
    padding: 0 10px;
    border-radius: var(--r-sm);
    border: none;
    background: transparent;
    color: var(--text-0);
    text-align: left;
    cursor: pointer;
  }

  .slash-menu-item.active,
  .slash-menu-item:hover:enabled {
    background: var(--bg-3);
  }

  .slash-menu-item:disabled {
    color: var(--text-2);
    cursor: not-allowed;
  }

  .label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
</style>
