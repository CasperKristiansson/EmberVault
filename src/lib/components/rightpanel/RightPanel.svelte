<script lang="ts">
  import type { BacklinkSnippet } from "$lib/core/editor/links/backlinks";
  import BacklinksPanel from "$lib/components/rightpanel/BacklinksPanel.svelte";
  import OutlinePanel from "$lib/components/rightpanel/OutlinePanel.svelte";
  import MetadataPanel from "$lib/components/rightpanel/MetadataPanel.svelte";
  import type {
    CustomFieldValue,
    NoteDocumentFile,
    Vault,
  } from "$lib/core/storage/types";

  type RightPanelTab = "outline" | "backlinks" | "metadata";

  type BacklinkEntry = {
    id: string;
    title: string;
    snippet: BacklinkSnippet | null;
  };

  export let activeTab: RightPanelTab = "outline";
  export let activeNoteId: string | null = null;
  export let activeNote: NoteDocumentFile | null = null;
  export let vault: Vault | null = null;
  export let linkedMentions: BacklinkEntry[] = [];
  export let backlinksLoading = false;
  export let onOpenNote: (noteId: string) => void = () => {};
  export let onUpdateCustomFields: (
    noteId: string,
    fields: Record<string, CustomFieldValue>
  ) => void = () => {};
</script>

<div class="right-panel" data-testid="right-panel-content">
  {#if activeTab === "outline"}
    <OutlinePanel {activeNoteId} />
  {:else if activeTab === "backlinks"}
    <BacklinksPanel
      {activeNoteId}
      {linkedMentions}
      loading={backlinksLoading}
      onOpenNote={onOpenNote}
    />
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
