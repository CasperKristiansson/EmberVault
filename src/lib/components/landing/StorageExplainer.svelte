<script lang="ts">
  type Mode = "folder" | "browser";
  let mode: Mode = "folder";
</script>

<div class="storage-panel" data-mode={mode}>
  <div class="panel-head">
    <div>
      <div class="panel-title">Storage choice</div>
      <div class="panel-sub">Pick the local option that fits your setup.</div>
    </div>
    <span class="badge">Local-only</span>
  </div>

  <div class="segmented" role="tablist" aria-label="Storage options">
    <button
      class:active={mode === "folder"}
      type="button"
      role="tab"
      aria-selected={mode === "folder"}
      aria-controls="storage-folder"
      on:click={() => (mode = "folder")}
    >
      Folder vault
    </button>
    <button
      class:active={mode === "browser"}
      type="button"
      role="tab"
      aria-selected={mode === "browser"}
      aria-controls="storage-browser"
      on:click={() => (mode = "browser")}
    >
      Browser storage
    </button>
    <span class="indicator" aria-hidden="true"></span>
  </div>

  <div class="panel-main">
    <div class="panel-content">
      <div
        class="content-block"
        id="storage-folder"
        role="tabpanel"
        data-active={mode === "folder"}
      >
        <div class="content-title">Folder vault (best on Chrome/Edge)</div>
        <div class="content-body">
          Store notes in a folder you choose. Files stay yours - easy to back up and move.
        </div>
        <ul>
          <li>Notes saved as files on disk</li>
          <li>Great for backups and portability</li>
          <li>Requires folder permission</li>
        </ul>
        <div class="content-meta">Uses File System Access on Chrome/Edge.</div>
      </div>

      <div
        class="content-block"
        id="storage-browser"
        role="tabpanel"
        data-active={mode === "browser"}
      >
        <div class="content-title">Browser storage (works everywhere)</div>
        <div class="content-body">
          Fast setup using IndexedDB. Still local-only - stored in this browser profile.
        </div>
        <ul>
          <li>No permissions prompt</li>
          <li>Great for quick setup</li>
          <li>Tied to this browser/device</li>
        </ul>
        <div class="content-meta">Available on all modern browsers.</div>
      </div>
    </div>

    <div class="panel-diagram" aria-hidden="true">
      <div class="diagram-block" data-active={mode === "folder"}>
        <div class="tree">
          <div class="tree-row">vault/</div>
          <div class="tree-row indent">notes/</div>
          <div class="tree-row indent-2">stress.md</div>
          <div class="tree-row indent-2">design.md</div>
          <div class="tree-row indent">assets/</div>
          <div class="tree-row indent-2">chart.png</div>
        </div>
      </div>
      <div class="diagram-block" data-active={mode === "browser"}>
        <div class="db">
          <div class="db-stack"></div>
          <div class="db-label">IndexedDB</div>
          <div class="db-nodes">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .storage-panel {
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-lg);
    padding: 24px;
    display: grid;
    gap: 24px;
    background: rgba(15, 18, 23, 0.6);
  }

  .panel-head {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
  }

  .panel-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-0);
  }

  .panel-sub {
    font-size: 12px;
    color: var(--text-2);
    margin-top: 6px;
  }

  .badge {
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--stroke-0);
    color: var(--text-2);
    background: rgba(15, 18, 23, 0.8);
  }

  .segmented {
    position: relative;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-bottom: 1px solid var(--stroke-0);
  }

  .segmented button {
    padding: 10px 0 12px;
    background: none;
    border: none;
    color: var(--text-2);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: color 120ms ease;
  }

  .segmented button.active {
    color: var(--text-0);
  }

  .segmented button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--focus-ring);
    border-radius: var(--r-sm);
  }

  .indicator {
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 50%;
    height: 2px;
    background: var(--accent-0);
    transition: left 160ms ease;
  }

  .storage-panel[data-mode="browser"] .indicator {
    left: 50%;
  }

  .panel-main {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
    gap: 32px;
    align-items: start;
  }

  .panel-content {
    position: relative;
    min-height: 180px;
  }

  .content-block {
    position: absolute;
    inset: 0;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 120ms ease, transform 120ms ease;
    pointer-events: none;
    display: grid;
    gap: 12px;
  }

  .content-block[data-active="true"] {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .content-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-0);
  }

  .content-body {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-1);
  }

  ul {
    list-style: disc;
    padding-left: 16px;
    margin: 0;
    display: grid;
    gap: 8px;
    color: var(--text-1);
    font-size: 13px;
  }

  .content-meta {
    font-size: 12px;
    color: var(--text-2);
  }

  .panel-diagram {
    position: relative;
    min-height: 180px;
    padding-left: 24px;
    border-left: 1px solid var(--stroke-0);
    display: flex;
    align-items: center;
  }

  .diagram-block {
    position: absolute;
    inset: 0 0 0 24px;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 120ms ease, transform 120ms ease;
    pointer-events: none;
    display: flex;
    align-items: center;
  }

  .diagram-block[data-active="true"] {
    opacity: 1;
    transform: translateY(0);
  }

  .tree {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
    font-size: 12px;
    color: var(--text-1);
    display: grid;
    gap: 8px;
  }

  .tree-row {
    color: var(--text-2);
  }

  .tree-row.indent {
    padding-left: 12px;
    color: var(--text-1);
  }

  .tree-row.indent-2 {
    padding-left: 24px;
    color: var(--text-1);
  }

  .db {
    display: grid;
    gap: 12px;
    color: var(--text-1);
  }

  .db-stack {
    width: 120px;
    height: 72px;
    border: 1px solid var(--stroke-0);
    border-radius: 60px / 18px;
    position: relative;
  }

  .db-stack::before,
  .db-stack::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 18px;
    border: 1px solid var(--stroke-0);
    border-radius: 60px / 18px;
    background: rgba(15, 18, 23, 0.7);
  }

  .db-stack::before {
    top: 18px;
  }

  .db-stack::after {
    top: 36px;
  }

  .db-label {
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-2);
  }

  .db-nodes {
    display: flex;
    gap: 8px;
  }

  .db-nodes span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--stroke-0);
  }

  @media (max-width: 900px) {
    .panel-main {
      grid-template-columns: 1fr;
    }

    .panel-diagram {
      border-left: none;
      border-top: 1px solid var(--stroke-0);
      padding: 20px 0 0;
      min-height: 140px;
    }

    .diagram-block {
      inset: 20px 0 0 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .content-block,
    .diagram-block {
      transition: opacity 80ms ease;
      transform: none;
    }

    .indicator {
      transition: none;
    }
  }
</style>
