<script lang="ts">
  import { onDestroy } from "svelte";
  import ConfirmDialog from "$lib/components/modals/ConfirmDialog.svelte";
  import type CommandPaletteModalType from "$lib/components/modals/CommandPaletteModal.svelte";
  import type GlobalSearchModalType from "$lib/components/modals/GlobalSearchModal.svelte";
  import type TrashModalType from "$lib/components/modals/TrashModal.svelte";
  import type { NoteIndexEntry, Project } from "$lib/core/storage/types";
  import type { SearchIndexState } from "$lib/state/search.store";
  import { activeModal, closeTopModal, modalStackStore } from "$lib/state/ui.store";

  export let project: Project | null = null;
  export let searchState: SearchIndexState | null = null;
  export let notes: NoteIndexEntry[] = [];
  export let trashedNotes: NoteIndexEntry[] = [];
  export let activeNoteId: string | null = null;
  export let onOpenNote: (noteId: string) => void | Promise<void> = async () => {};
  export let onRestoreTrashedNote: (noteId: string) => void | Promise<void> =
    async () => {};
  export let onDeleteTrashedNotePermanent: (noteId: string) => void = () => {};
  export let onCreateNote: (() => void | Promise<void>) | null = null;
  export let onOpenGlobalSearch: (() => void | Promise<void>) | null = null;
  export let onGoToTrash: (() => void | Promise<void>) | null = null;
  export let onToggleRightPanel:
    | ((panel: "outline" | "backlinks" | "metadata") => void | Promise<void>)
    | null = null;
  export let onOpenSettings: (() => void | Promise<void>) | null = null;

  let CommandPaletteModalComponent: typeof CommandPaletteModalType | null = null;
  let GlobalSearchModalComponent: typeof GlobalSearchModalType | null = null;
  let TrashModalComponent: typeof TrashModalType | null = null;

  const ensureCommandPaletteLoaded = async (): Promise<void> => {
    if (CommandPaletteModalComponent) {
      return;
    }
    const module = await import("$lib/components/modals/CommandPaletteModal.svelte");
    CommandPaletteModalComponent = module.default;
  };

  const ensureGlobalSearchLoaded = async (): Promise<void> => {
    if (GlobalSearchModalComponent) {
      return;
    }
    const module = await import("$lib/components/modals/GlobalSearchModal.svelte");
    GlobalSearchModalComponent = module.default;
  };

  const ensureTrashLoaded = async (): Promise<void> => {
    if (TrashModalComponent) {
      return;
    }
    const module = await import("$lib/components/modals/TrashModal.svelte");
    TrashModalComponent = module.default;
  };

  type ConfirmDialogData = {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void | Promise<void>;
  };

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

  const resolveConfirmData = (data: unknown): ConfirmDialogData => {
    if (!data || typeof data !== "object") {
      return { title: "Confirm" };
    }
    const input = data as Partial<ConfirmDialogData>;
    return {
      title: input.title ?? "Confirm",
      message: input.message,
      confirmLabel: input.confirmLabel,
      cancelLabel: input.cancelLabel,
      destructive: input.destructive,
      onConfirm: input.onConfirm,
      onCancel: input.onCancel,
    };
  };

  const handleConfirm = async (data: ConfirmDialogData): Promise<void> => {
    handleClose();
    await data.onConfirm?.();
  };

  const handleCancel = async (data: ConfirmDialogData): Promise<void> => {
    handleClose();
    await data.onCancel?.();
  };

  $: confirmDialogData =
    $activeModal?.type === "confirm"
      ? resolveConfirmData($activeModal.data)
      : null;

  $: if ($activeModal?.type === "global-search") {
    void ensureGlobalSearchLoaded();
  }

  $: if ($activeModal?.type === "command-palette") {
    void ensureCommandPaletteLoaded();
  }

  $: if ($activeModal?.type === "trash") {
    void ensureTrashLoaded();
  }
</script>

{#if $activeModal?.type === "global-search"}
  {#if GlobalSearchModalComponent}
    <svelte:component
      this={GlobalSearchModalComponent}
      {project}
      {searchState}
      onClose={handleClose}
      onOpenNote={onOpenNote}
    />
  {/if}
{:else if $activeModal?.type === "command-palette"}
  {#if CommandPaletteModalComponent}
    <svelte:component
      this={CommandPaletteModalComponent}
      {notes}
      {activeNoteId}
      onClose={handleClose}
      onOpenNote={onOpenNote}
      {onCreateNote}
      {onOpenGlobalSearch}
      {onGoToTrash}
      {onToggleRightPanel}
      {onOpenSettings}
    />
  {/if}
{:else if $activeModal?.type === "trash"}
  {#if TrashModalComponent}
    <svelte:component
      this={TrashModalComponent}
      {project}
      {trashedNotes}
      {activeNoteId}
      onClose={handleClose}
      onOpenNote={onOpenNote}
      onRestore={onRestoreTrashedNote}
      onDeletePermanent={onDeleteTrashedNotePermanent}
    />
  {/if}
{:else if $activeModal?.type === "confirm"}
  {#if confirmDialogData}
    <ConfirmDialog
      title={confirmDialogData.title}
      message={confirmDialogData.message ?? ""}
      confirmLabel={confirmDialogData.confirmLabel ?? "Confirm"}
      cancelLabel={confirmDialogData.cancelLabel ?? "Cancel"}
      destructive={confirmDialogData.destructive ?? false}
      onConfirm={() => void handleConfirm(confirmDialogData)}
      onCancel={() => void handleCancel(confirmDialogData)}
    />
  {/if}
{/if}
