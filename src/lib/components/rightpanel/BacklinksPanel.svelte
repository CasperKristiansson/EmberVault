<script lang="ts">
  import type { BacklinkSnippet } from "$lib/core/editor/links/backlinks";
  import BacklinkItem from "$lib/components/rightpanel/BacklinkItem.svelte";

  type BacklinkEntry = {
    id: string;
    title: string;
    snippet: BacklinkSnippet | null;
  };

  export let activeNoteId: string | null = null;
  export let linkedMentions: BacklinkEntry[] = [];
  export let loading = false;
  export let onOpenNote: (noteId: string) => void = () => {};
</script>

<div class="panel" data-testid="backlinks-panel">
  {#if !activeNoteId}
    <div class="panel-empty" data-testid="backlinks-empty">
      Select a note to view backlinks.
    </div>
  {:else}
    <section class="panel-section">
      <div class="panel-section-title">Linked mentions</div>
      {#if loading}
        <div class="panel-empty">Loading backlinks...</div>
      {:else if linkedMentions.length === 0}
        <div class="panel-empty">No linked mentions yet.</div>
      {:else}
        <div class="panel-list" data-testid="backlinks-list">
          {#each linkedMentions as entry (entry.id)}
            <BacklinkItem
              noteId={entry.id}
              title={entry.title}
              snippet={entry.snippet}
              onSelect={onOpenNote}
            />
          {/each}
        </div>
      {/if}
    </section>

    <section class="panel-section" aria-label="Unlinked mentions">
      <div class="panel-section-title">Unlinked mentions</div>
      <div class="panel-empty">Unlinked mentions are not available yet.</div>
    </section>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
  }

  .panel-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .panel-section-title {
    font-size: 12px;
    color: var(--text-2);
  }

  .panel-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .panel-empty {
    font-size: 12px;
    color: var(--text-2);
  }
</style>
