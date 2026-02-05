<script lang="ts">
  import { onDestroy } from "svelte";
  import CommandPaletteModal from "$lib/components/modals/CommandPaletteModal.svelte";
  import ConfirmDialog from "$lib/components/modals/ConfirmDialog.svelte";
  import GlobalSearchModal from "$lib/components/modals/GlobalSearchModal.svelte";
  import TemplatePickerModal from "$lib/components/modals/TemplatePickerModal.svelte";
  import type {
    NoteIndexEntry,
    Project,
    TemplateIndexEntry,
  } from "$lib/core/storage/types";
  import type { SearchIndexState } from "$lib/state/search.store";
  import { activeModal, closeTopModal, modalStackStore } from "$lib/state/ui.store";

  export let project: Project | null = null;
  export let projects: Project[] = [];
  export let searchState: SearchIndexState | null = null;
  export let notes: NoteIndexEntry[] = [];
  export let templates: TemplateIndexEntry[] = [];
  export let activeNoteId: string | null = null;
  export let lastUsedTemplateId: string | null = null;
  export let onOpenNote: (noteId: string) => void | Promise<void> = async () => {};
  export let onCreateNote: (() => void | Promise<void>) | null = null;
  export let onCreateNoteFromTemplate:
    | ((templateId: string) => void | Promise<void>)
    | null = null;
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

  type ConfirmDialogData = {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm?: () => void | Promise<void>;
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
    };
  };

  const handleConfirm = async (data: ConfirmDialogData): Promise<void> => {
    handleClose();
    await data.onConfirm?.();
  };

  $: confirmDialogData =
    $activeModal?.type === "confirm"
      ? resolveConfirmData($activeModal.data)
      : null;
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
{:else if $activeModal?.type === "template-picker"}
  <TemplatePickerModal
    {templates}
    {lastUsedTemplateId}
    onClose={handleClose}
    onCreateBlank={onCreateNote}
    onCreateFromTemplate={onCreateNoteFromTemplate}
  />
{:else if $activeModal?.type === "confirm"}
  {#if confirmDialogData}
    <ConfirmDialog
      title={confirmDialogData.title}
      message={confirmDialogData.message ?? ""}
      confirmLabel={confirmDialogData.confirmLabel ?? "Confirm"}
      cancelLabel={confirmDialogData.cancelLabel ?? "Cancel"}
      destructive={confirmDialogData.destructive ?? false}
      onConfirm={() => void handleConfirm(confirmDialogData)}
      onCancel={handleClose}
    />
  {/if}
{/if}
