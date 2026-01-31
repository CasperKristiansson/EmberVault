<script lang="ts">
  import { onDestroy } from "svelte";
  import CommandPaletteModal from "$lib/components/modals/CommandPaletteModal.svelte";
  import GlobalSearchModal from "$lib/components/modals/GlobalSearchModal.svelte";
  import type { NoteIndexEntry, Project } from "$lib/core/storage/types";
  import type { SearchIndexState } from "$lib/state/search.store";
  import { activeModal, closeTopModal, modalStackStore } from "$lib/state/ui.store";

  export let project: Project | null = null;
  export let projects: Project[] = [];
  export let searchState: SearchIndexState | null = null;
  export let notes: NoteIndexEntry[] = [];
  export let activeNoteId: string | null = null;
  export let onOpenNote: (noteId: string) => void | Promise<void> = async () => {};
  export let onCreateNote: (() => void | Promise<void>) | null = null;
  export let onOpenGlobalSearch: (() => void | Promise<void>) | null = null;
  export let onProjectChange: (projectId: string) => void | Promise<void> = async () => {};
  export let onToggleSplitView: (() => void | Promise<void>) | null = null;
  export let onOpenGraph: (() => void | Promise<void>) | null = null;
  export let onOpenTemplates: (() => void | Promise<void>) | null = null;
  export let onGoToTrash: (() => void | Promise<void>) | null = null;
  export let onToggleRightPanel:
    | ((panel: "outline" | "backlinks" | "metadata") => void | Promise<void>)
    | null = null;
  export let onOpenSettings: (() => void | Promise<void>) | null = null;

  let previousActiveElement: HTMLElement | null = null;
  let hadModal = false;
  let hasModal = false;

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") {
      return;
    }
    if (!hasModal) {
      return;
    }
    event.preventDefault();
    closeTopModal();
  };

  const detachKeyListener = (): void => {
    if (typeof window === "undefined") {
      return;
    }
    window.removeEventListener("keydown", handleKeydown);
  };

  const attachKeyListener = (): void => {
    if (typeof window === "undefined") {
      return;
    }
    window.addEventListener("keydown", handleKeydown);
  };

  $: hasModal = $modalStackStore.length > 0;
  $: if (hasModal && !hadModal) {
    if (typeof document !== "undefined") {
      previousActiveElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    }
    attachKeyListener();
  }
  $: if (!hasModal && hadModal) {
    detachKeyListener();
    previousActiveElement?.focus();
    previousActiveElement = null;
  }
  $: hadModal = hasModal;

  onDestroy(() => {
    detachKeyListener();
  });

  const handleClose = (): void => {
    closeTopModal();
  };
</script>

{#if $activeModal?.type === "global-search"}
  <GlobalSearchModal
    {project}
    {projects}
    {searchState}
    onClose={handleClose}
    onOpenNote={onOpenNote}
    onProjectChange={onProjectChange}
  />
{:else if $activeModal?.type === "command-palette"}
  <CommandPaletteModal
    {project}
    {projects}
    {notes}
    {activeNoteId}
    onClose={handleClose}
    onOpenNote={onOpenNote}
    {onCreateNote}
    {onOpenGlobalSearch}
    {onProjectChange}
    {onToggleSplitView}
    {onOpenGraph}
    {onOpenTemplates}
    {onGoToTrash}
    {onToggleRightPanel}
    {onOpenSettings}
  />
{/if}
