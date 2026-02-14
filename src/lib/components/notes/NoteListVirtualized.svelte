<script lang="ts">
  import { onMount } from "svelte";
  import type { NoteIndexEntry, Tag } from "$lib/core/storage/types";
  import NoteListRow from "$lib/components/notes/NoteListRow.svelte";

  export let notes: Array<{ id: string }> = [];
  export let titleOverrides: Record<string, string> = {};
  export let activeNoteId: string | null = null;
  export let onSelect: (noteId: string) => void | Promise<void> = async () => {};
  export let onDragStart: (noteId: string, event: DragEvent) => void = () => {};
  export let onDragOver: (noteId: string, event: DragEvent) => void = () => {};
  export let onDrop: (noteId: string, event: DragEvent) => void = () => {};
  export let onDragEnd: (noteId: string, event: DragEvent) => void = () => {};
  export let onToggleFavorite: (
    noteId: string,
    nextFavorite: boolean
  ) => void | Promise<void> = () => {};
  export let draggingNoteId: string | null = null;
  export let dropTargetNoteId: string | null = null;
  export let draggable = false;
  export let overscan = 6;
  export let virtualizeThreshold = 100;
  export let showMeta = true;
  export let showPreview = true;
  export let showTags = true;
  export let tagsById: Record<string, Tag> = {};

  let container: HTMLDivElement | null = null;
  let scrollTop = 0;
  let viewportHeight = 0;
  let rowHeight = 34;
  let rowGap = 4;
  let motionEnabled = true;

  const parseCssNumber = (value: string, fallback: number): number => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  };

  const syncMeasurements = (): void => {
    if (!container) {
      return;
    }
    viewportHeight = container.clientHeight;
    const styles = getComputedStyle(container);
    rowHeight = parseCssNumber(
      styles.getPropertyValue("--note-row-height"),
      rowHeight
    );
    rowGap = parseCssNumber(
      styles.getPropertyValue("--note-row-gap"),
      rowGap
    );
  };

  const handleScroll = (): void => {
    if (!container) {
      return;
    }
    scrollTop = container.scrollTop;
  };

  onMount(() => {
    if (!container) {
      return;
    }
    syncMeasurements();

    const onScroll = () => handleScroll();
    container.addEventListener("scroll", onScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        syncMeasurements();
      });
      resizeObserver.observe(container);
    }

    return () => {
      container?.removeEventListener("scroll", onScroll);
      resizeObserver?.disconnect();
    };
  });

  $: useVirtualization = notes.length > virtualizeThreshold;
  $: motionEnabled = !useVirtualization;
  $: rowStep = rowHeight + rowGap;
  $: totalHeight = notes.length > 0 ? notes.length * rowStep - rowGap : 0;
  $: safeViewport = Math.max(viewportHeight, rowStep);
  $: startIndex = useVirtualization
    ? Math.max(0, Math.floor(scrollTop / rowStep) - overscan)
    : 0;
  $: visibleCount = useVirtualization
    ? Math.min(notes.length, Math.ceil(safeViewport / rowStep) + overscan * 2)
    : notes.length;
  $: endIndex = useVirtualization
    ? Math.min(notes.length, startIndex + visibleCount)
    : notes.length;
  $: visibleNotes = notes.slice(startIndex, endIndex);
  $: offsetY = startIndex * rowStep;
</script>

<div
  class="note-list-virtualized"
  data-testid="note-list"
  data-virtualized={useVirtualization ? "true" : "false"}
  bind:this={container}
>
  {#if useVirtualization}
    <div class="note-list-spacer" style={`height: ${totalHeight}px;`}>
      <div class="note-list-items" style={`transform: translateY(${offsetY}px);`}>
        {#each visibleNotes as note (note.id)}
          <slot
            name="row"
            {note}
            active={note.id === activeNoteId}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
            {motionEnabled}
          >
            <NoteListRow
              note={note as NoteIndexEntry}
              active={note.id === activeNoteId}
              titleOverride={titleOverrides[note.id] ?? null}
              onSelect={noteId => void onSelect(noteId)}
              draggable={draggable}
              dragging={draggingNoteId === note.id}
              dropTarget={dropTargetNoteId === note.id}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              onToggleFavorite={onToggleFavorite}
              {showMeta}
              {showPreview}
              {showTags}
              {tagsById}
              {motionEnabled}
            />
          </slot>
        {/each}
      </div>
    </div>
  {:else}
    <div class="note-list-items note-list-items-static">
      {#each notes as note (note.id)}
        <slot
          name="row"
          {note}
          active={note.id === activeNoteId}
          onSelect={onSelect}
          onToggleFavorite={onToggleFavorite}
          {motionEnabled}
        >
          <NoteListRow
            note={note as NoteIndexEntry}
            active={note.id === activeNoteId}
            titleOverride={titleOverrides[note.id] ?? null}
            onSelect={noteId => void onSelect(noteId)}
            draggable={draggable}
            dragging={draggingNoteId === note.id}
            dropTarget={dropTargetNoteId === note.id}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            onToggleFavorite={onToggleFavorite}
            {showMeta}
            {showPreview}
            {showTags}
            {tagsById}
            {motionEnabled}
          />
        </slot>
      {/each}
    </div>
  {/if}
</div>

<style>
  .note-list-virtualized {
    --note-row-height: var(--density-list-row-height-desktop, 34px);
    --note-row-gap: var(--density-note-row-gap, 4px);

    flex: 1;
    min-height: 0;
    overflow: auto;
    padding-right: 4px;
  }

  .note-list-spacer {
    position: relative;
    width: 100%;
  }

  .note-list-items {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    gap: var(--note-row-gap);
  }

  .note-list-items-static {
    position: static;
  }

  @media (max-width: 767px) {
    .note-list-virtualized {
      --note-row-height: var(--density-list-row-height-mobile, 40px);
    }
  }
</style>
