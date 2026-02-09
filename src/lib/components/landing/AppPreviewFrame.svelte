<script lang="ts">
  import { Search, Settings2 } from "lucide-svelte";
</script>

<div
  class="preview"
  role="img"
  aria-label="EmberVault app preview with folders, notes, editor, code, and math"
>
  <div class="preview-chrome" aria-hidden="true">
    <div class="window-dots">
      <span class="dot red"></span>
      <span class="dot yellow"></span>
      <span class="dot green"></span>
    </div>
    <div class="window-title">EmberVault</div>
    <div class="window-actions">
      <button class="ghost" type="button" aria-label="Search">
        <Search size={16} />
      </button>
      <button class="ghost" type="button" aria-label="Settings">
        <Settings2 size={16} />
      </button>
    </div>
  </div>

  <div class="preview-body" aria-hidden="true">
    <aside class="pane sidebar">
      <div class="pane-title">Folders</div>
      <div class="pane-list">
        <div class="pane-item active">Inbox</div>
        <div class="pane-item">Research</div>
        <div class="pane-item">Work</div>
        <div class="pane-item">Archive</div>
      </div>

      <div class="pane-title">Tags</div>
      <div class="pane-tags">
        <span class="tag">math</span>
        <span class="tag">ideas</span>
        <span class="tag">code</span>
        <span class="tag">reading</span>
      </div>
    </aside>

    <section class="pane list">
      <div class="pane-title">Notes</div>
      <div class="note-item selected">
        <div class="note-title">Stress notes</div>
        <div class="note-preview">Quick start · formulas · table</div>
      </div>
      <div class="note-item">
        <div class="note-title">Meeting - Tue</div>
        <div class="note-preview">Agenda, decisions, follow-ups</div>
      </div>
      <div class="note-item">
        <div class="note-title">Daily log</div>
        <div class="note-preview">Tasks, highlights, blockers</div>
      </div>
      <div class="note-item">
        <div class="note-title">Design cues</div>
        <div class="note-preview">Density, spacing, orange accents</div>
      </div>
      <div class="note-item">
        <div class="note-title">Release checklist</div>
        <div class="note-preview">QA, docs, verify storage</div>
      </div>
    </section>

    <section class="pane editor">
      <div class="editor-header">
        <div class="editor-title">Stress notes</div>
        <div class="chips">
          <span class="chip">math</span>
          <span class="chip">code</span>
        </div>
      </div>

      <div class="editor-content">
        <div class="editor-h2">Quick start</div>
        <div class="editor-paragraph">Local-first notes. No accounts. No cloud.</div>

        <div class="checklist">
          <div class="check-row"><span class="check"></span>Choose storage</div>
          <div class="check-row"><span class="check"></span>Create notes</div>
          <div class="check-row"><span class="check"></span>Search instantly</div>
        </div>

        <pre class="code-block"><code>
<span class="kw">type</span> <span class="type">Note</span> = &#123; <span class="prop">id</span>: <span class="type">string</span>; <span class="prop">title</span>: <span class="type">string</span>; <span class="prop">updatedAt</span>: <span class="type">number</span> &#125;;
<span class="kw">const</span> <span class="fn">query</span> = (<span class="prop">q</span>: <span class="type">string</span>) =&gt; <span class="prop">index</span>.<span class="fn">search</span>(q, &#123; <span class="prop">fuzzy</span>: <span class="num">0.25</span> &#125;);
</code></pre>

        <div class="math-block">
          <div class="math-line">σ = F / A</div>
          <div class="math-line">ε = ΔL / L₀</div>
        </div>

        <table class="mini-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Meaning</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>σ</td>
              <td>Stress</td>
              <td>Pa</td>
            </tr>
            <tr>
              <td>ε</td>
              <td>Strain</td>
              <td>-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="pane peek">
      <div class="peek-line"></div>
      <div class="peek-line"></div>
      <div class="peek-line"></div>
    </div>
  </div>

  <div class="palette-overlay" aria-hidden="true">
    <div class="palette">
      <div class="palette-input">Search notes or run a command…</div>
      <div class="palette-list">
        <div class="palette-item">New note</div>
        <div class="palette-item">Open graph</div>
        <div class="palette-item">Toggle split view</div>
        <div class="palette-item">Search everywhere</div>
      </div>
    </div>
  </div>
</div>

<style>
  .preview {
    position: relative;
    border-radius: var(--r-lg);
    background: var(--bg-1);
    border: 1px solid var(--stroke-0);
    box-shadow: var(--shadow-panel);
    overflow: hidden;
    min-height: 360px;
  }

  .preview-chrome {
    height: 40px;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 0 16px;
    border-bottom: 1px solid var(--stroke-0);
    background: rgba(15, 18, 23, 0.9);
  }

  .window-dots {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    opacity: 0.75;
  }

  .dot.red {
    background: #ff5f56;
  }

  .dot.yellow {
    background: #ffbd2e;
  }

  .dot.green {
    background: #27c93f;
  }

  .window-title {
    font-size: 12px;
    color: var(--text-2);
    text-align: center;
  }

  .window-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .ghost {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .ghost:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .preview-body {
    display: grid;
    grid-template-columns: 180px 220px 1fr 36px;
    min-height: 360px;
  }

  .pane {
    padding: 16px;
    border-right: 1px solid var(--stroke-0);
    background: var(--bg-1);
  }

  .pane.sidebar {
    background: var(--bg-1);
  }

  .pane.list {
    background: var(--bg-2);
  }

  .pane.peek {
    padding: 16px 8px;
    border-right: none;
    background: var(--bg-1);
  }

  .pane-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-2);
    margin-bottom: 8px;
  }

  .pane-list {
    display: grid;
    gap: 8px;
    margin-bottom: 16px;
  }

  .pane-item {
    font-size: 12px;
    padding: 8px;
    border-radius: 8px;
    color: var(--text-1);
  }

  .pane-item.active {
    background: var(--accent-2);
    color: var(--text-0);
    box-shadow: inset 3px 0 0 var(--accent-0);
  }

  .pane-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tag {
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid var(--stroke-0);
    color: var(--text-1);
    background: var(--bg-2);
  }

  .note-item {
    padding: 8px 16px;
    border-radius: var(--r-md);
    margin-bottom: 8px;
    color: var(--text-1);
  }

  .note-item.selected {
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    color: var(--text-0);
  }

  .note-title {
    font-size: 13px;
    font-weight: 600;
  }

  .note-preview {
    font-size: 11px;
    color: var(--text-2);
    margin-top: 8px;
  }

  .editor {
    padding: 16px;
    background: var(--bg-1);
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .editor-title {
    font-size: 16px;
    font-weight: 600;
  }

  .chips {
    display: flex;
    gap: 8px;
  }

  .chip {
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 999px;
    background: var(--accent-2);
    color: var(--accent-1);
  }

  .editor-content {
    display: grid;
    gap: 16px;
    font-size: 12px;
    color: var(--text-1);
  }

  .editor-h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-0);
  }

  .editor-paragraph {
    color: var(--text-1);
  }

  .checklist {
    display: grid;
    gap: 8px;
  }

  .check-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .check {
    width: 12px;
    height: 12px;
    border-radius: 4px;
    border: 1px solid var(--stroke-1);
    background: transparent;
  }

  .code-block {
    margin: 0;
    padding: 8px 16px;
    background: var(--bg-2);
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
    font-size: 11px;
    color: var(--text-1);
    line-height: 1.4;
  }

  .kw {
    color: var(--accent-1);
  }

  .type {
    color: var(--info);
  }

  .prop {
    color: var(--text-1);
  }

  .fn {
    color: var(--warning);
  }

  .num {
    color: var(--success);
  }

  .math-block {
    display: grid;
    gap: 8px;
    font-size: 13px;
    color: var(--text-0);
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    padding: 8px 16px;
  }

  .math-line {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
  }

  .mini-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    color: var(--text-1);
  }

  .mini-table th,
  .mini-table td {
    border: 1px solid var(--stroke-0);
    padding: 8px;
    text-align: left;
  }

  .mini-table th {
    color: var(--text-0);
    font-weight: 600;
  }

  .peek {
    display: grid;
    gap: 8px;
    align-content: start;
  }

  .peek-line {
    height: 8px;
    border-radius: var(--r-sm);
    background: var(--stroke-0);
  }

  .palette-overlay {
    position: absolute;
    inset: 40px 0 0 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(10px) saturate(1.1);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .palette {
    width: min(460px, 90%);
    background: var(--bg-1);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-panel);
    padding: 16px;
    display: grid;
    gap: 8px;
  }

  .palette-input {
    padding: 8px 16px;
    border-radius: var(--r-sm);
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    color: var(--text-2);
    font-size: 12px;
  }

  .palette-list {
    display: grid;
    gap: 8px;
  }

  .palette-item {
    padding: 8px 16px;
    border-radius: 8px;
    background: var(--bg-2);
    color: var(--text-0);
    font-size: 12px;
  }

  @media (max-width: 1024px) {
    .preview-body {
      grid-template-columns: 160px 200px 1fr 28px;
    }
  }

  @media (max-width: 767px) {
    .preview-body {
      grid-template-columns: 1fr;
    }

    .pane.sidebar,
    .pane.list,
    .pane.peek {
      display: none;
    }

    .preview {
      min-height: 340px;
    }
  }
</style>
