<script lang="ts">
  import OutlinePanel from "$lib/components/rightpanel/OutlinePanel.svelte";
  import MetadataPanel from "$lib/components/rightpanel/MetadataPanel.svelte";
  import type {
    CustomFieldValue,
    NoteDocumentFile,
    Vault,
  } from "$lib/core/storage/types";

  type RightPanelTab = "outline" | "metadata";

  export let activeTab: RightPanelTab = "outline";
  export let activeNote: NoteDocumentFile | null = null;
  export let vault: Vault | null = null;
  export let onUpdateCustomFields: (
    noteId: string,
    fields: Record<string, CustomFieldValue>
  ) => void = () => {};
</script>

<div class="right-panel" data-testid="right-panel-content">
  {#if activeTab === "outline"}
    <OutlinePanel {activeNote} />
  {:else}
    <MetadataPanel
      note={activeNote}
      {vault}
      onUpdateCustomFields={onUpdateCustomFields}
    />
  {/if}
</div>

<style>
  .right-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }
</style>
