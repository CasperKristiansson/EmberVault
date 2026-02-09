<script lang="ts">
  import { motion } from "@motionone/svelte";
  import { prefersReducedMotion } from "$lib/state/motion.store";
  import { Star } from "lucide-svelte";
  import type { NoteIndexEntry } from "$lib/core/storage/types";

  export let note: NoteIndexEntry;
  export let titleOverride: string | null = null;
  export let active = false;
  export let motionEnabled = true;
  export let showMeta = true;
  export let onSelect: (noteId: string) => void = () => {};
  export let draggable = false;
  export let dragging = false;
  export let dropTarget = false;
  export let onDragStart: (noteId: string, event: DragEvent) => void = () => {};
  export let onDragOver: (noteId: string, event: DragEvent) => void = () => {};
  export let onDrop: (noteId: string, event: DragEvent) => void = () => {};
  export let onDragEnd: (noteId: string, event: DragEvent) => void = () => {};
  export let onToggleFavorite: (
    noteId: string,
    nextFavorite: boolean
  ) => void = () => {};

  const handleClick = (): void => {
    onSelect(note.id);
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(note.id);
    }
  };

  const handleFavoriteClick = (event: MouseEvent): void => {
    event.stopPropagation();
    onToggleFavorite(note.id, !note.favorite);
  };

  const handleDragStart = (event: DragEvent): void => {
    onDragStart(note.id, event);
  };

  const handleDragOver = (event: DragEvent): void => {
    onDragOver(note.id, event);
  };

  const handleDrop = (event: DragEvent): void => {
    onDrop(note.id, event);
  };

  const handleDragEnd = (event: DragEvent): void => {
    onDragEnd(note.id, event);
  };

  $: resolvedTitle = (titleOverride ?? note.title)?.trim()
    ? (titleOverride ?? note.title)
    : "Untitled";
  $: formattedDate = new Date(note.updatedAt).toLocaleDateString();
</script>

<div
  class={`note-row${active ? " active" : ""}`}
  role="button"
  tabindex="0"
  transition:motion={{
    preset: "list",
    reducedMotion: $prefersReducedMotion,
    enabled: motionEnabled,
  }}
  on:click={handleClick}
  on:keydown={handleKeydown}
  data-testid={`note-row-${note.id}`}
  data-note-id={note.id}
  data-dragging={dragging ? "true" : "false"}
  data-drop-target={dropTarget ? "true" : "false"}
  draggable={draggable}
  on:dragstart={handleDragStart}
  on:dragover={handleDragOver}
  on:drop={handleDrop}
  on:dragend={handleDragEnd}
>
  <button
    class="note-row-star"
    type="button"
    aria-pressed={note.favorite}
    aria-label={note.favorite ? "Remove from favorites" : "Add to favorites"}
    data-active={note.favorite ? "true" : "false"}
    data-testid="note-favorite-toggle-row"
    on:click={handleFavoriteClick}
  >
    <Star aria-hidden="true" size={14} />
  </button>
  <span class="note-row-title">{resolvedTitle}</span>
  {#if showMeta}
    <span class="note-row-meta">{formattedDate}</span>
  {/if}
</div>

<style>
  .note-row {
    height: var(--note-row-height);
    display: flex;
    align-items: center;
    justify-content: flex-start;
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

  .note-row[data-drop-target="true"] {
    background: var(--bg-3);
    border-color: var(--accent-0);
  }

  .note-row[data-dragging="true"] {
    opacity: 0.6;
  }

  .note-row-title {
    font-size: 13px;
    color: var(--text-0);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .note-row-meta {
    font-size: 12px;
    color: var(--text-2);
    margin-left: auto;
  }

  .note-row-star {
    height: 22px;
    width: 22px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-2);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
  }

  .note-row-star :global(svg) {
    width: 14px;
    height: 14px;
    display: block;
  }

  .note-row:hover .note-row-star,
  .note-row.active .note-row-star,
  .note-row-star[data-active="true"] {
    opacity: 1;
    pointer-events: auto;
  }

  .note-row-star:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .note-row-star:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .note-row-star[data-active="true"] {
    color: var(--accent-0);
  }

  .note-row-star[data-active="true"] :global(svg) {
    fill: currentColor;
  }

  @media (max-width: 767px) {
    .note-row-star {
      opacity: 1;
      pointer-events: auto;
    }
  }
</style>
