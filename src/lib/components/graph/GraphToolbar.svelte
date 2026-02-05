<script lang="ts">
  type GraphMode = "project" | "note";

  export let mode: GraphMode = "project";
  export let depth = 1;
  export let depthDisabled = false;
  export let searchQuery = "";
  export let tagFilter = "all";
  export let tagOptions: { id: string; name: string }[] = [];
  export let onRecenter: () => void = () => {};
</script>

<div class="graph-toolbar" data-testid="graph-toolbar">
  <div class="graph-mode" role="group" aria-label="Graph mode">
    <button
      class="graph-mode-button"
      type="button"
      aria-pressed={mode === "project"}
      on:click={() => (mode = "project")}
    >
      Project
    </button>
    <button
      class="graph-mode-button"
      type="button"
      aria-pressed={mode === "note"}
      on:click={() => (mode = "note")}
    >
      Neighborhood
    </button>
  </div>

  <label class="graph-field">
    <span class="graph-label">Search nodes</span>
    <input
      class="graph-input"
      type="text"
      placeholder="Search"
      bind:value={searchQuery}
      aria-label="Search graph nodes"
    />
  </label>

  <label class="graph-field">
    <span class="graph-label">Depth</span>
    <div class="graph-range">
      <input
        class="graph-slider"
        type="range"
        min="1"
        max="3"
        step="1"
        bind:value={depth}
        disabled={depthDisabled}
        aria-label="Neighborhood depth"
      />
      <span class="graph-range-value">{depth}</span>
    </div>
  </label>

  <label class="graph-field">
    <span class="graph-label">Tag</span>
    <select class="graph-select" bind:value={tagFilter} aria-label="Tag filter">
      <option value="all">All tags</option>
      {#each tagOptions as tag (tag.id)}
        <option value={tag.id}>{tag.name}</option>
      {/each}
    </select>
  </label>

  <button class="graph-recenter" type="button" on:click={onRecenter}>
    Recenter
  </button>
</div>

<style>
  .graph-toolbar {
    display: grid;
    grid-template-columns: auto minmax(140px, 1fr) auto auto auto;
    gap: 12px;
    align-items: center;
    padding: 12px;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-2);
  }

  .graph-mode {
    display: inline-flex;
    gap: 6px;
    padding: 2px;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-1);
  }

  .graph-mode-button {
    height: 32px;
    padding: 0 12px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-1);
    font-size: 12px;
    cursor: pointer;
  }

  .graph-mode-button[aria-pressed="true"] {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .graph-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .graph-label {
    font-size: 12px;
    color: var(--text-2);
  }

  .graph-input,
  .graph-select {
    height: 32px;
    padding: 0 12px;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-2);
    color: var(--text-0);
  }

  .graph-input::placeholder {
    color: var(--text-2);
  }

  .graph-input:focus-visible,
  .graph-select:focus-visible,
  .graph-slider:focus-visible,
  .graph-recenter:focus-visible,
  .graph-mode-button:focus-visible {
    border-color: rgba(255, 138, 42, 0.4);
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .graph-range {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .graph-slider {
    flex: 1;
    accent-color: var(--accent-0);
  }

  .graph-range-value {
    width: 16px;
    font-size: 12px;
    color: var(--text-1);
    text-align: right;
  }

  .graph-recenter {
    height: 32px;
    padding: 0 14px;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-1);
    background: transparent;
    color: var(--text-0);
    font-size: 12px;
    cursor: pointer;
  }

  .graph-recenter:hover {
    background: var(--bg-3);
  }

  @media (max-width: 1023px) {
    .graph-toolbar {
      grid-template-columns: 1fr 1fr;
      grid-auto-rows: auto;
    }
  }
</style>
