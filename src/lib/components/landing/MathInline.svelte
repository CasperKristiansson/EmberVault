<script lang="ts">
  import katex from "katex";

  export let latex: string;
  export let displayMode = false;

  $: html = katex.renderToString(latex, {
    throwOnError: false,
    displayMode,
  });
</script>

<span class="math" role="img" aria-label={latex}>
  {@html html}
</span>

<style>
  .math :global(.katex) {
    font-size: 1em;
  }

  .math :global(.katex-display) {
    margin: 0;
  }
</style>
