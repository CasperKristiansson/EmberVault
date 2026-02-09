<script lang="ts">
  import { motion } from "@motionone/svelte";
  import {
    HelpCircle,
    Hash,
    ListChecks,
    Link2,
    Sigma,
    Keyboard,
    X,
  } from "lucide-svelte";
  import { prefersReducedMotion } from "$lib/state/motion.store";

  export let onClose: (() => void | Promise<void>) | null = null;

  type HelpSection =
    | "overview"
    | "markdown"
    | "blocks"
    | "links"
    | "math"
    | "shortcuts";

  let activeSection: HelpSection = "overview";
</script>

<div
  class="modal-overlay"
  data-testid="help-modal"
  transition:motion={{ preset: "fade", reducedMotion: $prefersReducedMotion }}
>
  <div
    class="modal-panel"
    role="dialog"
    aria-modal="true"
    transition:motion={{ preset: "modal", reducedMotion: $prefersReducedMotion }}
  >
    <header class="modal-header">
      <div class="modal-heading">
        <div class="modal-title">Editor help</div>
        <div class="modal-subtitle">Markdown, blocks, and shortcuts.</div>
      </div>
      <button
        class="icon-button"
        type="button"
        aria-label="Close help"
        on:click={() => void onClose?.()}
      >
        <X aria-hidden="true" size={16} />
      </button>
    </header>

    <div class="modal-body">
      <nav class="help-nav" aria-label="Help sections">
        <button
          class="help-item"
          type="button"
          data-active={activeSection === "overview"}
          on:click={() => (activeSection = "overview")}
        >
          <HelpCircle aria-hidden="true" size={16} />
          <span>Overview</span>
        </button>
        <button
          class="help-item"
          type="button"
          data-active={activeSection === "markdown"}
          on:click={() => (activeSection = "markdown")}
        >
          <Hash aria-hidden="true" size={16} />
          <span>Markdown</span>
        </button>
        <button
          class="help-item"
          type="button"
          data-active={activeSection === "blocks"}
          on:click={() => (activeSection = "blocks")}
        >
          <ListChecks aria-hidden="true" size={16} />
          <span>Blocks</span>
        </button>
        <button
          class="help-item"
          type="button"
          data-active={activeSection === "links"}
          on:click={() => (activeSection = "links")}
        >
          <Link2 aria-hidden="true" size={16} />
          <span>Links & Media</span>
        </button>
        <button
          class="help-item"
          type="button"
          data-active={activeSection === "math"}
          on:click={() => (activeSection = "math")}
        >
          <Sigma aria-hidden="true" size={16} />
          <span>Math</span>
        </button>
        <button
          class="help-item"
          type="button"
          data-active={activeSection === "shortcuts"}
          on:click={() => (activeSection = "shortcuts")}
        >
          <Keyboard aria-hidden="true" size={16} />
          <span>Shortcuts</span>
        </button>
      </nav>

      <section class="help-content">
        {#if activeSection === "overview"}
          <div class="section-header">
            <div class="section-title">Overview</div>
            <div class="section-description">
              Quick ways to insert and navigate content.
            </div>
          </div>

          <div class="help-group">
            <div class="help-row">
              <div class="help-copy">
                <div class="help-title">Slash menu</div>
                <div class="help-description">
                  Type <code>/</code> or press <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> +
                  <kbd>/</kbd> to insert blocks.
                </div>
              </div>
              <div class="help-example">
                <code>/</code>
              </div>
            </div>

            <div class="help-row">
              <div class="help-copy">
                <div class="help-title">Wiki links</div>
                <div class="help-description">
                  Link to another note by typing <code>[[</code> and selecting a
                  title.
                </div>
              </div>
              <div class="help-example">
                <code>[[Meeting notes]]</code>
              </div>
            </div>

            <div class="help-row">
              <div class="help-copy">
                <div class="help-title">Images</div>
                <div class="help-description">
                  Paste or drag images directly into the editor. Click to view
                  full size.
                </div>
              </div>
              <div class="help-example">
                <code>Paste</code>
              </div>
            </div>
          </div>
        {:else if activeSection === "markdown"}
          <div class="section-header">
            <div class="section-title">Markdown</div>
            <div class="section-description">
              Markdown-style input rules supported in the editor.
            </div>
          </div>

          <div class="help-grid">
            <div class="help-card">
              <div class="help-title">Heading (H2/H3)</div>
              <div class="help-example"><code>## Heading</code></div>
            </div>
            <div class="help-card">
              <div class="help-title">Bold</div>
              <div class="help-example"><code>**bold**</code></div>
            </div>
            <div class="help-card">
              <div class="help-title">Italic</div>
              <div class="help-example"><code>*italic*</code></div>
            </div>
            <div class="help-card">
              <div class="help-title">Strikethrough</div>
              <div class="help-example"><code>~~strike~~</code></div>
            </div>
            <div class="help-card">
              <div class="help-title">Inline code</div>
              <div class="help-example"><code>`code`</code></div>
            </div>
            <div class="help-card">
              <div class="help-title">Blockquote</div>
              <div class="help-example"><code>&gt; Quote</code></div>
            </div>
            <div class="help-card">
              <div class="help-title">Bulleted list</div>
              <div class="help-example"><code>- Item</code></div>
            </div>
            <div class="help-card">
              <div class="help-title">Numbered list</div>
              <div class="help-example"><code>1. Item</code></div>
            </div>
            <div class="help-card">
              <div class="help-title">Checklist</div>
              <div class="help-example"><code>- [ ] Task</code></div>
            </div>
            <div class="help-card">
              <div class="help-title">Code block</div>
              <div class="help-example"><code>```ts</code></div>
            </div>
          </div>
        {:else if activeSection === "blocks"}
          <div class="section-header">
            <div class="section-title">Blocks</div>
            <div class="section-description">
              Insert blocks with the slash menu.
            </div>
          </div>

          <div class="help-group">
            <div class="help-row">
              <div class="help-copy">
                <div class="help-title">Available blocks</div>
                <div class="help-description">
                  Heading, List, Checklist, Quote, Code block, Table, Divider,
                  Math block.
                </div>
              </div>
              <div class="help-example">
                <code>/</code>
              </div>
            </div>

            <div class="help-row">
              <div class="help-copy">
                <div class="help-title">Coming soon</div>
                <div class="help-description">
                  Image, Callout, Embed URL (shown in the menu but disabled).
                </div>
              </div>
              <div class="help-example">
                <span class="pill">Soon</span>
              </div>
            </div>
          </div>
        {:else if activeSection === "links"}
          <div class="section-header">
            <div class="section-title">Links & Media</div>
            <div class="section-description">
              Connect notes and attach media.
            </div>
          </div>

          <div class="help-group">
            <div class="help-row">
              <div class="help-copy">
                <div class="help-title">Internal links</div>
                <div class="help-description">
                  Use wiki links to reference another note.
                </div>
              </div>
              <div class="help-example">
                <code>[[Project brief]]</code>
              </div>
            </div>

            <div class="help-row">
              <div class="help-copy">
                <div class="help-title">External links</div>
                <div class="help-description">
                  Paste a URL to create a link automatically.
                </div>
              </div>
              <div class="help-example">
                <code>https://example.com</code>
              </div>
            </div>

            <div class="help-row">
              <div class="help-copy">
                <div class="help-title">Images</div>
                <div class="help-description">
                  Drag/drop or paste images to embed them inline.
                </div>
              </div>
              <div class="help-example">
                <code>Drag & drop</code>
              </div>
            </div>
          </div>
        {:else if activeSection === "math"}
          <div class="section-header">
            <div class="section-title">Math</div>
            <div class="section-description">KaTeX-powered LaTeX support.</div>
          </div>

          <div class="help-group">
            <div class="help-row">
              <div class="help-copy">
                <div class="help-title">Inline math</div>
                <div class="help-description">
                  Wrap expressions in single dollar signs.
                </div>
              </div>
              <div class="help-example">
                <code>$x^2 + y^2$</code>
              </div>
            </div>

            <div class="help-row">
              <div class="help-copy">
                <div class="help-title">Block math</div>
                <div class="help-description">
                  Use double dollar signs on their own lines.
                </div>
              </div>
              <div class="help-example">
                <code>$$E = mc^2$$</code>
              </div>
            </div>
          </div>
        {:else if activeSection === "shortcuts"}
          <div class="section-header">
            <div class="section-title">Shortcuts</div>
            <div class="section-description">Editor-focused keyboard actions.</div>
          </div>

          <div class="help-group">
            <div class="help-row">
              <div class="help-copy">
                <div class="help-title">Undo</div>
                <div class="help-description">Reverse the last change.</div>
              </div>
              <div class="help-example">
                <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Z</kbd>
              </div>
            </div>

            <div class="help-row">
              <div class="help-copy">
                <div class="help-title">Redo</div>
                <div class="help-description">Reapply the last change.</div>
              </div>
              <div class="help-example">
                <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd>
              </div>
            </div>

            <div class="help-row">
              <div class="help-copy">
                <div class="help-title">Open slash menu</div>
                <div class="help-description">Insert a block at the cursor.</div>
              </div>
              <div class="help-example">
                <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>/</kbd>
              </div>
            </div>

            <div class="help-row">
              <div class="help-copy">
                <div class="help-title">Close menus</div>
                <div class="help-description">Dismiss the current menu.</div>
              </div>
              <div class="help-example">
                <kbd>Esc</kbd>
              </div>
            </div>
          </div>
        {/if}
      </section>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(10px) saturate(1.1);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal-panel {
    width: min(860px, calc(100% - 32px));
    height: min(600px, 84vh);
    background: var(--bg-1);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-panel);
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    z-index: 110;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .modal-heading {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .modal-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-0);
  }

  .modal-subtitle {
    font-size: 12px;
    color: var(--text-1);
  }

  .modal-body {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    gap: 16px;
    flex: 1;
    min-height: 0;
  }

  .help-nav {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .help-item {
    height: 32px;
    padding: 0 10px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-1);
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    text-align: left;
  }

  .help-item[data-active="true"] {
    background: var(--bg-2);
    border-color: var(--stroke-0);
    color: var(--text-0);
  }

  .help-item:hover:enabled {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .help-content {
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-lg);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: auto;
  }

  .section-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 500;
  }

  .section-description {
    font-size: 12px;
    color: var(--text-1);
  }

  .help-group {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .help-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 0;
    border-top: 1px solid var(--stroke-0);
  }

  .help-row:first-child {
    border-top: none;
    padding-top: 0;
  }

  .help-copy {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .help-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-0);
  }

  .help-description {
    font-size: 12px;
    color: var(--text-1);
  }

  .help-example {
    font-size: 12px;
    color: var(--text-2);
    text-align: right;
  }

  .help-example code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid var(--stroke-0);
    background: var(--bg-1);
    color: var(--text-0);
  }

  .help-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .help-card {
    padding: 12px;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-1);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .help-card .help-example {
    text-align: left;
  }

  kbd {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid var(--stroke-0);
    background: var(--bg-1);
    color: var(--text-0);
  }

  .pill {
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--bg-1);
    border: 1px solid var(--stroke-0);
    font-size: 11px;
    color: var(--text-2);
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

  @media (max-width: 800px) {
    .modal-panel {
      width: min(94vw, 820px);
      height: min(82vh, 600px);
    }

    .modal-body {
      grid-template-columns: 1fr;
    }

    .help-nav {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 8px;
    }

    .help-item {
      flex: 1 1 140px;
      justify-content: center;
    }
  }
</style>
