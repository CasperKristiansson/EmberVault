<script lang="ts">
  import { motion } from "@motionone/svelte";
  import { prefersReducedMotion } from "$lib/state/motion.store";
  import { X } from "lucide-svelte";
  import type { NoteIndexEntry } from "$lib/core/storage/types";
  import NoteListVirtualized from "$lib/components/notes/NoteListVirtualized.svelte";
  import TrashNoteRow from "$lib/components/notes/TrashNoteRow.svelte";

  export let trashedNotes: NoteIndexEntry[] = [];
  export let activeNoteId: string | null = null;
  export let onClose: () => void = () => {};
  export let onOpenNote: (noteId: string) => void | Promise<void> = async () => {};
  export let onRestore: (noteId: string) => void | Promise<void> = async () => {};
  export let onDeletePermanent: (noteId: string) => void = () => {};

  const handleSelect = async (noteId: string): Promise<void> => {
    await onOpenNote(noteId);
    onClose();
  };
</script>

<div
  class="modal-overlay"
  data-testid="trash-modal"
  transition:motion={{ preset: "fade", reducedMotion: $prefersReducedMotion }}
>
  <div
    class="modal-panel"
    role="dialog"
    aria-modal="true"
    aria-label="Trash"
    transition:motion={{ preset: "modal", reducedMotion: $prefersReducedMotion }}
  >
    <div class="modal-header">
      <div>
        <div class="modal-title">Trash</div>
        <div class="modal-subtitle">
          {trashedNotes.length} total
        </div>
      </div>
      <button
        class="icon-button"
        type="button"
        aria-label="Close trash"
        data-testid="trash-close"
        on:click={onClose}
      >
        <X aria-hidden="true" size={16} />
      </button>
    </div>

    {#if trashedNotes.length === 0}
      <div class="modal-empty">Trash is empty.</div>
    {:else}
      <div class="trash-list" data-testid="trash-list">
        <NoteListVirtualized
          notes={trashedNotes}
          activeNoteId={activeNoteId}
          onSelect={noteId => void handleSelect(noteId)}
          draggable={false}
        >
          <svelte:fragment slot="row" let:note let:active let:motionEnabled>
            <TrashNoteRow
              note={note as NoteIndexEntry}
              {active}
              {motionEnabled}
              onSelect={noteId => void handleSelect(noteId)}
              onRestore={noteId => void onRestore(noteId)}
              onDeletePermanent={onDeletePermanent}
            />
          </svelte:fragment>
        </NoteListVirtualized>
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(10px) saturate(1.1);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 12px;
  }

  .modal-panel {
    width: min(720px, calc(100% - 24px));
    max-height: min(640px, calc(100vh - 24px));
    background: var(--bg-1);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-panel);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .modal-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-0);
  }

  .modal-subtitle {
    margin-top: 2px;
    font-size: 12px;
    color: var(--text-2);
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }

  .icon-button {
    width: 32px;
    height: 32px;
    border-radius: var(--r-md);
    border: none;
    background: transparent;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-1);
    flex: 0 0 auto;
  }

  .icon-button:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .icon-button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .icon-button :global(svg) {
    display: block;
  }

  .modal-empty {
    font-size: 13px;
    color: var(--text-2);
    padding: 12px;
  }

  .trash-list {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    --note-row-height: 52px;
    --note-row-gap: 6px;
  }

  @media (max-width: 767px) {
    .modal-panel {
      padding: 14px;
    }
  }
</style>
