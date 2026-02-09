<script lang="ts">
  import MathInline from "$lib/components/landing/MathInline.svelte";
</script>

<div class="stack">
  <div class="panel">
    <div class="panel-title">Markdown-friendly blocks</div>
    <div class="mini-editor">
      <div class="line heading">## Heading</div>
      <div class="line">- [ ] Checklist item</div>
      <div class="line quote">&gt; Quote</div>
      <div class="divider"></div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-title">Code blocks</div>
    <pre class="code"><code>
<span class="kw">type</span> <span class="type">Note</span> = &#123; <span class="prop">id</span>: <span class="type">string</span>; <span class="prop">title</span>: <span class="type">string</span>; <span class="prop">updatedAt</span>: <span class="type">number</span> &#125;;
<span class="kw">const</span> <span class="fn">query</span> = (<span class="prop">q</span>: <span class="type">string</span>) =&gt; <span class="prop">index</span>.<span class="fn">search</span>(q, &#123; <span class="prop">fuzzy</span>: <span class="num">0.25</span> &#125;);
</code></pre>
  </div>

  <div class="panel math">
    <div class="panel-title">Inline math (rendered, code-adjacent)</div>
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

<style>
  .stack {
    display: grid;
    gap: 16px;
  }

  .panel {
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    padding: 16px;
    display: grid;
    gap: 8px;
  }

  .panel-title {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-2);
  }

  .mini-editor {
    display: grid;
    gap: 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
    font-size: 12px;
    color: var(--text-1);
  }

  .line.heading {
    color: var(--text-0);
    font-weight: 600;
  }

  .line.quote {
    color: var(--text-2);
  }

  .divider {
    height: 1px;
    background: var(--stroke-0);
    margin-top: 8px;
  }

  .code {
    margin: 0;
    padding: 8px 16px;
    background: var(--bg-2);
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
    font-size: 12px;
    color: var(--text-1);
    line-height: 1.45;
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

  .math {
    position: relative;
  }

  .math::before {
    content: "";
    position: absolute;
    left: -1px;
    top: 16px;
    bottom: 16px;
    width: 2px;
    border-radius: 2px;
    background: var(--accent-0);
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
</style>
