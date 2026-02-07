<script lang="ts">
  import { motion } from "@motionone/svelte";
  import { prefersReducedMotion } from "$lib/state/motion.store";
  import { RotateCcw, Trash2 } from "lucide-svelte";
  import type { NoteIndexEntry } from "$lib/core/storage/types";

  export let note: NoteIndexEntry;
  export let active = false;
  export let motionEnabled = true;
  export let onSelect: (noteId: string) => void = () => {};
  export let onRestore: (noteId: string) => void = () => {};
  export let onDeletePermanent: (noteId: string) => void = () => {};

  const handleClick = (): void => {
    onSelect(note.id);
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(note.id);
    }
  };

  const handleRestoreClick = (event: MouseEvent): void => {
    event.stopPropagation();
    onRestore(note.id);
  };

  const handleDeleteClick = (event: MouseEvent): void => {
    event.stopPropagation();
    onDeletePermanent(note.id);
  };

  $: resolvedTitle = note.title?.trim() ? note.title : "Untitled";
  $: deletedDate =
    typeof note.deletedAt === "number"
      ? new Date(note.deletedAt).toLocaleDateString()
      : "";
  $: deletedLabel = deletedDate ? `Deleted ${deletedDate}` : "Deleted";
</script>

<div
  class={`note-row${active ? " active" : ""}`}
  role="button"
  tabindex="0"
  data-testid="trash-row"
  data-note-id={note.id}
  transition:motion={{
    preset: "list",
    reducedMotion: $prefersReducedMotion,
    enabled: motionEnabled,
  }}
  on:click={handleClick}
  on:keydown={handleKeydown}
>
  <span class="note-row-title">{resolvedTitle}</span>
  <span class="note-row-meta">{deletedLabel}</span>
  <div class="note-row-actions">
    <button
      class="note-row-action"
      type="button"
      aria-label="Restore note"
      data-testid="trash-restore"
      on:click={handleRestoreClick}
    >
      <RotateCcw aria-hidden="true" size={14} />
    </button>
    <button
      class="note-row-action danger"
      type="button"
      aria-label="Delete permanently"
      data-testid="trash-delete"
      on:click={handleDeleteClick}
    >
      <Trash2 aria-hidden="true" size={14} />
    </button>
  </div>
</div>

<style>
  .note-row {
    height: var(--note-row-height);
    display: flex;
    align-items: center;
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

  .note-row:hover {
    background: var(--bg-3);
  }

  .note-row:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .note-row.active {
    background: var(--accent-2);
    border-color: var(--accent-2);
    position: relative;
  }

  .note-row.active::before {
    content: "";
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 3px;
    background: var(--accent-0);
    border-radius: 3px;
  }

  .note-row-title {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    color: var(--text-0);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .note-row-meta {
    font-size: 12px;
    color: var(--text-2);
  }

  .note-row-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .note-row:hover .note-row-actions,
  .note-row.active .note-row-actions {
    opacity: 1;
  }

  @media (max-width: 767px) {
    .note-row-actions {
      opacity: 1;
    }
  }

  .note-row-action {
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-1);
    cursor: pointer;
  }

  .note-row-action:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .note-row-action:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .note-row-action.danger:hover {
    color: var(--danger);
  }

  .note-row-action :global(svg) {
    width: 14px;
    height: 14px;
    display: block;
  }

  @media (max-width: 767px) {
    .note-row-actions {
      opacity: 1;
    }
  }
</style>
