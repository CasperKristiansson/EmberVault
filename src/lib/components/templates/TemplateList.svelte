<script lang="ts">
  import { motion } from "@motionone/svelte";
  import { prefersReducedMotion } from "$lib/state/motion.store";
  import NoteListVirtualized from "$lib/components/notes/NoteListVirtualized.svelte";
  import type { TemplateIndexEntry } from "$lib/core/storage/types";

  export let templates: TemplateIndexEntry[] = [];
  export let activeTemplateId: string | null = null;
  export let totalCount = 0;
  export let isLoading = false;
  export let onCreate: (() => void | Promise<void>) | null = null;
  export let onSelect: (templateId: string) => void | Promise<void> = async () => {};

  const formatTitle = (template: TemplateIndexEntry): string =>
    template.title.trim() || "Untitled";

  const formatDate = (template: TemplateIndexEntry): string =>
    new Date(template.updatedAt).toLocaleDateString();
</script>

<header class="template-list-header">
  <div>
    <div class="template-list-title">Templates</div>
    <div class="template-list-subtitle">{totalCount} total</div>
  </div>
  <div class="template-list-actions">
    <button
      class="button primary"
      type="button"
      data-testid="new-template"
      on:click={() => void onCreate?.()}
      disabled={isLoading}
    >
      New template
    </button>
  </div>
</header>

{#if isLoading}
  <div class="template-list-empty">Loading templates...</div>
{:else if templates.length === 0}
  <div class="template-list-empty">No templates yet.</div>
{:else}
  <NoteListVirtualized
    notes={templates}
    activeNoteId={activeTemplateId}
    onSelect={templateId => void onSelect(templateId)}
    virtualizeThreshold={100}
  >
    <svelte:fragment
      slot="row"
      let:note
      let:active
      let:onSelect
      let:motionEnabled
    >
      <button
        class={`template-row${active ? " active" : ""}`}
        type="button"
        data-testid={`template-row-${note.id}`}
        transition:motion={{
          preset: "list",
          reducedMotion: $prefersReducedMotion,
          enabled: motionEnabled,
        }}
        on:click={() => void onSelect(note.id)}
      >
        <span class="template-row-title">
          {formatTitle(note as TemplateIndexEntry)}
        </span>
        <span class="template-row-meta">
          {formatDate(note as TemplateIndexEntry)}
        </span>
      </button>
    </svelte:fragment>
  </NoteListVirtualized>
{/if}

<style>
  .template-list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .template-list-title {
    font-weight: 500;
  }

  .template-list-subtitle {
    font-size: 12px;
    color: var(--text-2);
  }

  .template-list-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .template-list-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-2);
    font-size: 13px;
  }

  .template-row {
    height: var(--note-row-height, 34px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 10px 0 12px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-0);
    cursor: pointer;
    text-align: left;
    width: 100%;
  }

  .template-row:hover {
    background: var(--bg-3);
  }

  .template-row:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .template-row.active {
    background: var(--accent-2);
    border-color: var(--accent-2);
    position: relative;
  }

  .template-row.active::before {
    content: "";
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 3px;
    background: var(--accent-0);
    border-radius: 3px;
  }

  .template-row-title {
    font-size: 13px;
    color: var(--text-0);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .template-row-meta {
    font-size: 12px;
    color: var(--text-2);
  }

  .button {
    height: 32px;
    padding: 0 14px;
    border-radius: var(--r-md);
    border: 1px solid transparent;
    cursor: pointer;
  }

  .button.primary {
    background: var(--accent-0);
    color: #0b0d10;
  }

  .button.primary:hover:enabled {
    background: var(--accent-1);
  }

  .button.primary:active:enabled {
    transform: translateY(0.5px);
    filter: brightness(0.96);
  }

  .button.primary:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
