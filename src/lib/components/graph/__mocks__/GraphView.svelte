<script lang="ts">
  import type { NoteIndexEntry, Tag } from "$lib/core/storage/types";

  export let notes: NoteIndexEntry[] = [];
  export let tags: Record<string, Tag> = {};
  export let activeNoteId: string | null = null;
  export let onNodeClick: (noteId: string) => void = () => {};

  const handleClick = (): void => {
    const targetId = notes[0]?.id;
    if (targetId) {
      onNodeClick(targetId);
    }
  };
</script>

<div
  data-testid="graph-view-mock"
  data-active-note={activeNoteId ?? ""}
  data-tag-count={Object.keys(tags).length}
>
  <button
    type="button"
    data-testid="graph-node-trigger"
    on:click={handleClick}
  >
    Open first node
  </button>
</div>
