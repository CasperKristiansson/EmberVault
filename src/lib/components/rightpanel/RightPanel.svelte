<script lang="ts">
  import OutlinePanel from "$lib/components/rightpanel/OutlinePanel.svelte";
  import MetadataPanel from "$lib/components/rightpanel/MetadataPanel.svelte";
  import type { BacklinkSnippet } from "$lib/core/editor/links/backlinks";
  import type {
    CustomFieldValue,
    NoteDocumentFile,
    Vault,
  } from "$lib/core/storage/types";

  type RightPanelTab = "outline" | "metadata";

  export let activeTab: RightPanelTab = "outline";
  export let activeNote: NoteDocumentFile | null = null;
  export let vault: Vault | null = null;
  export let linkedMentions: Array<{
    id: string;
    title: string;
    snippet: BacklinkSnippet | null;
  }> = [];
  export let unlinkedMentions: Array<{
    id: string;
    title: string;
    snippet: BacklinkSnippet | null;
  }> = [];
  export let backlinksLoading = false;
  export let unlinkedMentionsLoading = false;
  export let onOpenNote: (noteId: string) => void = () => {};
  export let onResolveWikiLink: (
    raw: string,
    targetId: string
  ) => void | Promise<void> = async () => {};
  export let onNormalizeWikiLinks: (
    replacements: Array<{ raw: string; targetId: string }>
  ) => void | Promise<void> = async () => {};
  export let onCreateNoteForWikiLink: (title: string) => Promise<string> =
    async () => "";
  export let onUpdateCustomFields: (
    noteId: string,
    fields: Record<string, CustomFieldValue>
  ) => void = () => {};
  export let onMoveNoteToFolder: (
    noteId: string,
    folderId: string | null
  ) => void | Promise<void> = async () => {};
</script>

<div class="right-panel" data-testid="right-panel-content">
  {#if activeTab === "outline"}
    <OutlinePanel {activeNote} />
  {:else}
    <MetadataPanel
      note={activeNote}
      {vault}
      {linkedMentions}
      {unlinkedMentions}
      {backlinksLoading}
      {unlinkedMentionsLoading}
      {onOpenNote}
      {onResolveWikiLink}
      {onNormalizeWikiLinks}
      {onCreateNoteForWikiLink}
      onUpdateCustomFields={onUpdateCustomFields}
      onMoveNoteToFolder={onMoveNoteToFolder}
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
