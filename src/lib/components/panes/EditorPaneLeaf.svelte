<script lang="ts">
  import { FileText, PenLine, Star, Trash2 } from "lucide-svelte";
  import TiptapEditor from "$lib/components/editor/TiptapEditor.svelte";
  import MarkdownPreview from "$lib/components/editor/MarkdownPreview.svelte";
  import type { WikiLinkCandidate } from "$lib/core/editor/wiki-links";
  import type { NoteDocumentFile } from "$lib/core/storage/types";
  import { toDerivedMarkdown } from "$lib/core/utils/derived-markdown";

  type PaneState = {
    tabs: string[];
    activeTabId: string | null;
    note: NoteDocumentFile | null;
    titleValue: string;
    editorContent: Record<string, unknown>;
    editorPlainText: string;
    tabViewModes: Record<string, "editor" | "markdown">;
  };

  export let paneId: string;
  export let pane: PaneState;
  export let isLoading = false;
  export let isActive = false;
  export let chips: Array<{ key: string; label: string }> = [];
  export let linkCandidates: WikiLinkCandidate[] = [];

  export let onSetActive: (paneId: string) => void = () => {};
  export let onKeydown: (event: KeyboardEvent, paneId: string) => void = () => {};
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
  export let spellcheck = true;
  export let smartListContinuation = false;

  $: activeViewMode =
    pane.activeTabId && pane.tabViewModes[pane.activeTabId]
      ? pane.tabViewModes[pane.activeTabId]!
      : "editor";
  $: isMarkdownView = activeViewMode === "markdown";
  $: markdown =
    pane.note && isMarkdownView
      ? toDerivedMarkdown(pane.note.title ?? "", pane.editorPlainText ?? "")
      : "";
</script>

<div
  class="editor-pane"
  data-testid="editor-pane-leaf"
  data-pane-id={paneId}
  data-active={isActive}
  on:focusin={() => onSetActive(paneId)}
  on:click={() => onSetActive(paneId)}
  on:keydown={event => onKeydown(event, paneId)}
  role="button"
  tabindex="0"
>
  {#if isLoading}
    <div class="editor-empty">Preparing editor...</div>
  {:else if !pane.note}
    <div class="editor-empty">Select a note to start writing.</div>
  {:else}
    <div class="editor-actions" aria-label="Note actions">
      {#if pane.note}
        <button
          class="icon-button"
          type="button"
          aria-label={isMarkdownView ? "Switch to editor view" : "Switch to Markdown view"}
          data-testid="toggle-markdown-view"
          on:click|stopPropagation={() => onToggleMarkdownView(paneId)}
        >
          {#if isMarkdownView}
            <PenLine aria-hidden="true" size={16} />
          {:else}
            <FileText aria-hidden="true" size={16} />
          {/if}
        </button>
      {/if}
      <button
        class="icon-button editor-favorite"
        type="button"
        aria-pressed={pane.note.favorite}
        aria-label={pane.note.favorite ? "Remove from favorites" : "Add to favorites"}
        data-active={pane.note.favorite ? "true" : "false"}
        data-testid="note-favorite-toggle"
        on:click|stopPropagation={() => onToggleFavorite(paneId)}
      >
        <Star aria-hidden="true" size={16} />
      </button>
      {#if pane.note.deletedAt === null}
        <button
          class="icon-button note-delete"
          type="button"
          aria-label="Move note to trash"
          data-testid="note-delete"
          on:click|stopPropagation={() => onDeleteNote(paneId)}
        >
          <Trash2 aria-hidden="true" size={16} />
        </button>
      {/if}
    </div>

    {#if chips.length > 0}
      <div class="chips-row" aria-label="Metadata chips">
        {#each chips as chip (chip.key)}
          <span class="metadata-chip">{chip.label}</span>
        {/each}
      </div>
    {/if}

    <div class="editor-body">
      {#if isMarkdownView}
        <MarkdownPreview {markdown} />
      {:else}
        <TiptapEditor
          content={pane.note.pmDoc}
          contentKey={pane.note.id}
          noteId={pane.note.id}
          ariaLabel="Note content"
          dataTestId="note-body"
          chrome="flat"
          focusEmptyTitleOnClick={true}
          linkCandidates={linkCandidates}
          {spellcheck}
          {smartListContinuation}
          {onImagePaste}
          onUpdate={payload => onEditorUpdate(paneId, payload)}
        />
      {/if}
    </div>
  {/if}
</div>

<style>
  .editor-pane {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    position: relative;
  }

  .editor-actions {
    position: absolute;
    top: 0;
    right: 0;
    display: inline-flex;
    gap: 8px;
    padding: 4px;
    border-radius: var(--r-md);
    background: color-mix(in srgb, var(--bg-1) 65%, transparent);
    border: 1px solid var(--stroke-0);
    z-index: 1;
  }

  .icon-button {
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: var(--r-md);
    border: none;
    background: transparent;
    color: var(--text-1);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .icon-button:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .icon-button[aria-pressed="true"] {
    background: var(--bg-2);
    color: var(--text-0);
  }

  .icon-button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .icon-button :global(svg) {
    width: 16px;
    height: 16px;
    display: block;
  }

  .editor-favorite[data-active="true"] {
    color: var(--accent-0);
  }

  .editor-favorite[data-active="true"] :global(svg) {
    fill: currentColor;
  }

  .note-delete:hover {
    color: var(--danger);
  }

  .chips-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .editor-body {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .metadata-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: var(--r-sm);
    border: 1px solid var(--stroke-0);
    background: var(--bg-2);
    color: var(--text-1);
    font-size: 12px;
    line-height: 1.2;
  }

  .editor-empty {
    color: var(--text-2);
  }
</style>
