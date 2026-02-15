<script lang="ts">
  import EditorPaneLeaf from "$lib/components/panes/EditorPaneLeaf.svelte";
  import type { PaneLayoutNode } from "$lib/core/utils/pane-layout";
  import type { WikiLinkCandidate } from "$lib/core/editor/wiki-links";
  import type { NoteDocumentFile } from "$lib/core/storage/types";

  type PaneState = {
    tabs: string[];
    activeTabId: string | null;
    note: NoteDocumentFile | null;
    titleValue: string;
    editorContent: Record<string, unknown>;
    editorPlainText: string;
    tabViewModes: Record<string, "editor" | "markdown">;
  };

  export let node: PaneLayoutNode;
  export let paneStates: Record<string, PaneState> = {};
  export let activePaneId = "primary";
  export let isLoading = false;
  export let linkCandidates: WikiLinkCandidate[] = [];
  export let spellcheck = true;
  export let smartListContinuation = false;
  export let getChips: (
    note: NoteDocumentFile | null
  ) => Array<{ key: string; label: string }> = () => [];

  export let onSetActive: (paneId: string) => void = () => {};
  export let onKeydown: (event: KeyboardEvent, paneId: string) => void =
    () => {};
  export let onToggleFavorite: (paneId: string) => void = () => {};
  export let onDeleteNote: (paneId: string) => void = () => {};
  export let onToggleMarkdownView: (paneId: string) => void = () => {};
  export let onEditorUpdate: (
    paneId: string,
    payload: { json: Record<string, unknown>; text: string }
  ) => void = () => {};
  export let onImagePaste: (file: File | Blob) => Promise<{
    assetId: string;
    src: string;
    alt?: string;
    mime?: string;
    width?: number;
    height?: number;
  } | null> = async () => null;

  const emptyPane: PaneState = {
    tabs: [],
    activeTabId: null,
    note: null,
    titleValue: "",
    editorContent: {},
    editorPlainText: "",
    tabViewModes: {},
  };
</script>

{#if node.type === "leaf"}
  {@const paneId = node.paneId}
  {@const pane = paneStates[paneId] ?? emptyPane}
  <EditorPaneLeaf
    {paneId}
    {pane}
    {isLoading}
    isActive={activePaneId === paneId}
    chips={getChips(pane.note)}
    {linkCandidates}
    {spellcheck}
    {smartListContinuation}
    {onSetActive}
    {onKeydown}
    {onToggleFavorite}
    {onDeleteNote}
    {onToggleMarkdownView}
    {onEditorUpdate}
    {onImagePaste}
  />
{:else}
  <div class="pane-split" data-direction={node.direction}>
    {#each node.children as child, index (index)}
      {@const size = node.sizes?.[index] ?? 1}
      <div class="pane-split-child" style={`flex: ${size} 1 0%;`}>
        <svelte:self
          node={child}
          {paneStates}
          {activePaneId}
          {isLoading}
          {linkCandidates}
          {spellcheck}
          {smartListContinuation}
          {getChips}
          {onSetActive}
          {onKeydown}
          {onToggleFavorite}
          {onDeleteNote}
          {onToggleMarkdownView}
          {onEditorUpdate}
          {onImagePaste}
        />
      </div>
    {/each}
  </div>
{/if}

<style>
  .pane-split {
    display: flex;
    min-width: 0;
    min-height: 0;
    width: 100%;
    height: 100%;
    gap: 16px;
  }

  .pane-split[data-direction="row"] {
    flex-direction: row;
  }

  .pane-split[data-direction="column"] {
    flex-direction: column;
  }

  .pane-split-child {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex: 1;
  }

  @media (max-width: 1023px) {
    .pane-split[data-direction="row"] {
      flex-direction: column;
    }
  }
</style>
