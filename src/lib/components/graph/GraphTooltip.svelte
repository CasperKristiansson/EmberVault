<script lang="ts">
  type GraphTooltipNode = {
    title: string;
    tags: string[];
  };

  export let node: GraphTooltipNode | null = null;
</script>

{#if node}
  <div class="graph-tooltip" role="status" aria-live="polite">
    <div class="graph-tooltip-title">{node.title}</div>
    {#if node.tags.length > 0}
      <div class="graph-tooltip-tags" aria-label="Tags">
        {#each node.tags as tag (tag)}
          <span class="graph-tooltip-tag">{tag}</span>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .graph-tooltip {
    position: absolute;
    top: 16px;
    right: 16px;
    max-width: 220px;
    padding: 10px 12px;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-2);
    color: var(--text-0);
    box-shadow: var(--shadow-panel);
    display: flex;
    flex-direction: column;
    gap: 6px;
    pointer-events: none;
  }

  .graph-tooltip-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-0);
  }

  .graph-tooltip-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .graph-tooltip-tag {
    font-size: 11px;
    color: var(--text-1);
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--bg-3);
    border: 1px solid var(--stroke-0);
  }
</style>
