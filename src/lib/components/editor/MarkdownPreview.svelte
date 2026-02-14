<script lang="ts">
  export let markdown = "";
  export let dataTestId = "markdown-preview";
</script>

<div class="markdown-preview" data-testid={dataTestId} aria-label="Markdown preview">
  <pre class="markdown-pre">{markdown}</pre>
</div>

<style>
  .markdown-preview {
    flex: 1;
    min-height: 0;
    overflow: auto;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-2);
    padding: 16px;
  }

  .markdown-pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text-0);
    font-size: 13px;
    line-height: 1.55;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
  }
</style>

