<script lang="ts">
  import type { NoteIndexEntry } from "$lib/core/storage/types";

  export let note: NoteIndexEntry;
  export let active = false;
  export let onSelect: (noteId: string) => void = () => {};

  const handleClick = (): void => {
    onSelect(note.id);
  };

  $: resolvedTitle = note.title?.trim() ? note.title : "Untitled";
  $: formattedDate = new Date(note.updatedAt).toLocaleDateString();
</script>

<button
  class={`note-row${active ? " active" : ""}`}
  type="button"
  on:click={handleClick}
  data-testid={`note-row-${note.id}`}
>
  <span class="note-row-title">{resolvedTitle}</span>
  <span class="note-row-meta">{formattedDate}</span>
</button>

<style>
  .note-row {
    height: var(--note-row-height);
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
  }

  .note-row:hover {
    background: var(--bg-3);
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
    font-size: 13px;
    color: var(--text-0);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .note-row-meta {
    font-size: 11px;
    color: var(--text-2);
  }
</style>
