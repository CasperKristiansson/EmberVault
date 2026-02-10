<script lang="ts">
  import { onMount } from "svelte";
  import katex from "katex";

  export let latex: string;
  export let displayMode = false;

  let container: HTMLSpanElement | null = null;
  let mounted = false;

  const renderMath = (): void => {
    if (!container) {
      return;
    }
    katex.render(latex, container, {
      throwOnError: false,
      displayMode,
    });
  };

  onMount(() => {
    mounted = true;
    return () => {
      mounted = false;
    };
  });

  $: if (mounted) {
    renderMath();
  }
</script>

<span class="math" role="img" aria-label={latex} bind:this={container}></span>

<style>
  .math :global(.katex) {
    font-size: 1em;
  }

  .math :global(.katex-display) {
    margin: 0;
  }
</style>
