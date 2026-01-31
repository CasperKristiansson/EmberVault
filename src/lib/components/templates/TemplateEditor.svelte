<script lang="ts">
  import type { NoteDocumentFile } from "$lib/core/storage/types";
  import type { WikiLinkCandidate } from "$lib/core/editor/wiki-links";
  import TiptapEditor from "$lib/components/editor/TiptapEditor.svelte";

  export let template: NoteDocumentFile | null = null;
  export let titleValue = "";
  export let editorContent: Record<string, unknown> = {};
  export let isLoading = false;
  export let titleInput: HTMLInputElement | null = null;
  export let linkCandidates: WikiLinkCandidate[] = [];
  export let onImagePaste: (file: File | Blob) => Promise<{
    assetId: string;
    src: string;
    alt?: string;
    mime?: string;
    width?: number;
    height?: number;
  } | null> = async () => null;
  export let onTitleInput: (event: Event) => void = () => {};
  export let onTitleBlur: (event: Event) => void = () => {};
  export let onEditorUpdate: (payload: {
    json: Record<string, unknown>;
    text: string;
  }) => void = () => {};
</script>

{#if isLoading}
  <div class="template-editor-empty">Preparing templates...</div>
{:else if !template}
  <div class="template-editor-empty">Select a template to start editing.</div>
{:else}
  <div class="template-editor-header">
    <input
      class="title-input field-input"
      data-testid="template-title"
      type="text"
      placeholder="Untitled"
      bind:this={titleInput}
      value={titleValue}
      on:input={onTitleInput}
      on:blur={onTitleBlur}
      aria-label="Template title"
    />
  </div>

  <div class="field field-body">
    <span class="field-label">Content</span>
    <TiptapEditor
      content={editorContent}
      ariaLabel="Template content"
      dataTestId="template-body"
      linkCandidates={linkCandidates}
      onImagePaste={onImagePaste}
      onUpdate={onEditorUpdate}
    />
  </div>
{/if}

<style>
  .template-editor-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-2);
    font-size: 13px;
    min-height: 240px;
  }

  .template-editor-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field-label {
    font-size: 12px;
    color: var(--text-2);
  }

  .field-input {
    width: 100%;
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    color: var(--text-0);
    padding: 8px 12px;
  }

  .field-input:focus {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
