<script lang="ts">
  import MathInline from "$lib/components/landing/MathInline.svelte";

  type Tab = "markdown" | "code" | "math";
  let tab: Tab = "markdown";
</script>

<div class="editor-panel" data-tab={tab}>
  <div class="tab-strip" role="tablist" aria-label="Editor views">
    <button
      type="button"
      role="tab"
      aria-selected={tab === "markdown"}
      aria-controls="editor-markdown"
      class:active={tab === "markdown"}
      on:click={() => (tab = "markdown")}
    >
      Markdown
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={tab === "code"}
      aria-controls="editor-code"
      class:active={tab === "code"}
      on:click={() => (tab = "code")}
    >
      Code
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={tab === "math"}
      aria-controls="editor-math"
      class:active={tab === "math"}
      on:click={() => (tab = "math")}
    >
      Math
    </button>
    <span class="indicator" aria-hidden="true"></span>
  </div>

  <div class="tab-body">
    <div
      class="tab-content"
      id="editor-markdown"
      role="tabpanel"
      data-active={tab === "markdown"}
    >
      <div class="md-line heading">## Project outline</div>
      <div class="md-line">- [ ] Checklist item</div>
      <div class="md-line">- [x] Ship a clean release</div>
      <div class="md-line quote">&gt; A calm, local-first workflow.</div>
      <div class="md-divider"></div>
      <div class="md-line subtle">--- End ---</div>
    </div>

    <div class="tab-content" id="editor-code" role="tabpanel" data-active={tab === "code"}>
      <pre class="code"><code>
<span class="kw">type</span> <span class="type">Note</span> = &#123; <span class="prop">id</span>: <span class="type">string</span>; <span class="prop">title</span>: <span class="type">string</span> &#125;;
<span class="kw">const</span> <span class="fn">search</span> = (<span class="prop">q</span>: <span class="type">string</span>) =&gt; <span class="prop">index</span>.<span class="fn">find</span>(q);
</code></pre>
    </div>

    <div class="tab-content" id="editor-math" role="tabpanel" data-active={tab === "math"}>
      <div class="math-source">Stress: $ &#92;sigma = &#92;frac&#123;F&#125;&#123;A&#125; $</div>
      <div class="math-rendered">
        <MathInline latex={"\\sigma = \\frac{F}{A}"} />
      </div>
      <div class="math-source">
        Strain: $ &#92;varepsilon = &#92;frac&#123;&#92;Delta L&#125;&#123;L_0&#125; $
      </div>
      <div class="math-rendered">
        <MathInline latex={"\\varepsilon = \\frac{\\Delta L}{L_0}"} />
      </div>
    </div>
  </div>
</div>

<style>
  .editor-panel {
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-lg);
    background: rgba(15, 18, 23, 0.75);
    padding: 20px 24px 24px;
    display: grid;
    gap: 20px;
    box-shadow: var(--shadow-panel);
  }

  .tab-strip {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    border-bottom: 1px solid var(--stroke-0);
    padding-bottom: 12px;
  }

  .tab-strip button {
    background: none;
    border: none;
    color: var(--text-2);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    padding: 0;
    transition: color 120ms ease;
  }

  .tab-strip button.active {
    color: var(--text-0);
  }

  .tab-strip button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--focus-ring);
    border-radius: var(--r-sm);
  }

  .indicator {
    position: absolute;
    bottom: -1px;
    left: 0;
    height: 2px;
    width: 33.33%;
    background: var(--accent-0);
    transition: left 160ms ease;
  }

  .editor-panel[data-tab="code"] .indicator {
    left: 33.33%;
  }

  .editor-panel[data-tab="math"] .indicator {
    left: 66.66%;
  }

  .tab-body {
    position: relative;
    min-height: 170px;
  }

  .tab-content {
    position: absolute;
    inset: 0;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 120ms ease, transform 120ms ease;
    pointer-events: none;
    display: grid;
    gap: 12px;
  }

  .tab-content[data-active="true"] {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .md-line {
    font-size: 13px;
    color: var(--text-1);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
  }

  .md-line.heading {
    color: var(--text-0);
    font-weight: 600;
  }

  .md-line.quote {
    color: var(--text-2);
  }

  .md-line.subtle {
    color: var(--text-2);
  }

  .md-divider {
    height: 1px;
    background: var(--stroke-0);
    margin: 4px 0;
  }

  .code {
    margin: 0;
    padding: 12px 16px;
    background: rgba(11, 13, 16, 0.6);
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
    font-size: 12px;
    color: var(--text-1);
    line-height: 1.5;
  }

  .kw {
    color: var(--text-0);
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

  .math-source {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
    font-size: 12px;
    color: var(--text-2);
  }

  .math-rendered {
    font-size: 16px;
    color: var(--text-0);
  }

  .math-rendered :global(.katex) {
    display: block;
  }

  @media (max-width: 767px) {
    .editor-panel {
      padding: 18px 20px 22px;
    }

    .tab-strip {
      gap: 8px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tab-content {
      transition: opacity 80ms ease;
      transform: none;
    }

    .indicator {
      transition: none;
    }
  }
</style>
