<script lang="ts">
  export let activeNoteId: string | null = null;
</script>

<div class="panel" data-testid="metadata-panel">
  {#if !activeNoteId}
    <div class="panel-empty">Select a note to view metadata.</div>
  {:else}
    <div class="panel-empty">Metadata will appear here.</div>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .panel-empty {
    font-size: 12px;
    color: var(--text-2);
  }
</style>
