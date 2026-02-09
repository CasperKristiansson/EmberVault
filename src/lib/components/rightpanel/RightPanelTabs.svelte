<script lang="ts">
  type RightPanelTab = "outline" | "metadata";

  export let activeTab: RightPanelTab = "outline";
  export let onSelect: (tab: RightPanelTab) => void = () => {};

  const handleSelect = (tab: RightPanelTab): void => {
    if (tab === activeTab) {
      return;
    }
    onSelect(tab);
  };
</script>

<div class="right-panel-tabs" role="group" aria-label="Right panel tabs">
  <button
    class="right-panel-tab"
    type="button"
    aria-pressed={activeTab === "outline"}
    data-testid="right-panel-tab-outline"
    on:click={() => handleSelect("outline")}
  >
    Outline
  </button>
  <button
    class="right-panel-tab"
    type="button"
    aria-pressed={activeTab === "metadata"}
    data-testid="right-panel-tab-metadata"
    on:click={() => handleSelect("metadata")}
  >
    Metadata
  </button>
</div>

<style>
  .right-panel-tabs {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .right-panel-tab {
    height: 32px;
    padding: 0 10px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-1);
    cursor: pointer;
    font-size: 12px;
  }

  .right-panel-tab:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .right-panel-tab:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .right-panel-tab[aria-pressed="true"] {
    background: var(--bg-2);
    border-color: var(--stroke-0);
    color: var(--text-0);
  }
</style>
