<script lang="ts">
  import { onMount, tick } from "svelte";
  import { motion } from "@motionone/svelte";
  import { X } from "lucide-svelte";
  import type { NoteIndexEntry } from "$lib/core/storage/types";
  import { prefersReducedMotion } from "$lib/state/motion.store";

  export let notes: NoteIndexEntry[] = [];
  export let activeNoteId: string | null = null;
  export let onClose: () => void = () => {};
  export let onOpenNote: (noteId: string) => void | Promise<void> = async () => {};
  export let onCreateNote: (() => void | Promise<void>) | null = null;
  export let onOpenGlobalSearch: (() => void | Promise<void>) | null = null;
  export let onToggleSplitView: (() => void | Promise<void>) | null = null;
  export let onGoToTrash: (() => void | Promise<void>) | null = null;
  export let onToggleRightPanel:
    | ((panel: "outline" | "backlinks" | "metadata") => void | Promise<void>)
    | null = null;
  export let onOpenSettings: (() => void | Promise<void>) | null = null;

  type PaletteGroup = "Notes" | "Actions" | "Settings";

  type PaletteItem =
    | {
        type: "note";
        id: string;
        title: string;
        subtitle: string;
        group: "Notes";
        disabled?: boolean;
      }
    | {
        type: "action";
        id: string;
        label: string;
        group: "Actions" | "Settings";
        disabled?: boolean;
        perform: () => void | Promise<void>;
      };

  type PaletteGroupEntry = {
    group: PaletteGroup;
    items: PaletteItem[];
  };

  type PaletteActionItem = Extract<PaletteItem, { type: "action" }>;

  let query = "";
  let selectedIndex = -1;
  let inputElement: HTMLInputElement | null = null;
  let normalizedQuery = "";
  let noteItems: PaletteItem[] = [];
  let actionItems: PaletteItem[] = [];
  let settingsItems: PaletteItem[] = [];
  let groupedItems: PaletteGroupEntry[] = [];
  let flatItems: PaletteItem[] = [];

  const normalize = (value: string): string => value.trim().toLowerCase();
  const matches = (value: string, filter: string): boolean => {
    if (!filter) {
      return true;
    }
    return value.toLowerCase().includes(filter);
  };

  const formatNoteSubtitle = (note: NoteIndexEntry): string => {
    const updated = new Date(note.updatedAt).toLocaleDateString();
    return note.id === activeNoteId ? `Active · ${updated}` : `Updated ${updated}`;
  };

  const runAction = async (item: PaletteItem): Promise<void> => {
    if (item.disabled) {
      return;
    }
    onClose();
    if (item.type === "note") {
      await onOpenNote(item.id);
      return;
    }
    await item.perform();
  };

  const handleClick = (item: PaletteItem): void => {
    void runAction(item);
  };

  const getFirstSelectableIndex = (items: PaletteItem[]): number => {
    return items.findIndex((item) => !item.disabled);
  };

  const moveSelection = (direction: 1 | -1): void => {
    if (flatItems.length === 0) {
      return;
    }
    let nextIndex = selectedIndex;
    for (let step = 0; step < flatItems.length; step += 1) {
      nextIndex = (nextIndex + direction + flatItems.length) % flatItems.length;
      if (!flatItems[nextIndex]?.disabled) {
        selectedIndex = nextIndex;
        return;
      }
    }
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = flatItems[selectedIndex];
      if (item) {
        void runAction(item);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  const buildActionItems = (filter: string): PaletteActionItem[] => {
    const actions: PaletteActionItem[] = [
      {
        type: "action",
        id: "new-note",
        label: "New note",
        group: "Actions",
        disabled: !onCreateNote,
        perform: async () => {
          await onCreateNote?.();
        },
      },
      {
        type: "action",
        id: "search-everywhere",
        label: "Search everywhere",
        group: "Actions",
        disabled: !onOpenGlobalSearch,
        perform: async () => {
          await onOpenGlobalSearch?.();
        },
      },
      {
        type: "action",
        id: "toggle-split",
        label: "Toggle split view",
        group: "Actions",
        disabled: !onToggleSplitView,
        perform: async () => {
          await onToggleSplitView?.();
        },
      },
      {
        type: "action",
        id: "go-to-trash",
        label: "Go to Trash",
        group: "Actions",
        disabled: !onGoToTrash,
        perform: async () => {
          await onGoToTrash?.();
        },
      },
    ];

    return actions.filter((action) => matches(action.label, filter));
  };

  const buildSettingsItems = (filter: string): PaletteActionItem[] => {
    const settings: PaletteActionItem[] = [
      {
        type: "action",
        id: "panel-outline",
        label: "Toggle right panel: Outline",
        group: "Settings",
        disabled: !onToggleRightPanel,
        perform: async () => {
          await onToggleRightPanel?.("outline");
        },
      },
      {
        type: "action",
        id: "panel-backlinks",
        label: "Toggle right panel: Backlinks",
        group: "Settings",
        disabled: !onToggleRightPanel,
        perform: async () => {
          await onToggleRightPanel?.("backlinks");
        },
      },
      {
        type: "action",
        id: "panel-metadata",
        label: "Toggle right panel: Metadata",
        group: "Settings",
        disabled: !onToggleRightPanel,
        perform: async () => {
          await onToggleRightPanel?.("metadata");
        },
      },
      {
        type: "action",
        id: "open-settings",
        label: "Settings",
        group: "Settings",
        disabled: !onOpenSettings,
        perform: async () => {
          await onOpenSettings?.();
        },
      },
    ];

    return settings.filter((action) => matches(action.label, filter));
  };

  const buildNoteItems = (filter: string): PaletteItem[] => {
    const filteredNotes = notes
      .filter((note) => !note.deletedAt)
      .filter((note) => matches(note.title ?? "", filter))
      .sort((first, second) => second.updatedAt - first.updatedAt)
      .slice(0, 8);

    return filteredNotes.map((note) => ({
      type: "note",
      id: note.id,
      title: note.title?.trim() ? note.title : "Untitled",
      subtitle: formatNoteSubtitle(note),
      group: "Notes",
    }));
  };

  $: normalizedQuery = normalize(query);
  $: noteItems = buildNoteItems(normalizedQuery);
  $: actionItems = buildActionItems(normalizedQuery);
  $: settingsItems = buildSettingsItems(normalizedQuery);
  $: groupedItems = [
    { group: "Notes", items: noteItems },
    { group: "Actions", items: actionItems },
    { group: "Settings", items: settingsItems },
  ] as PaletteGroupEntry[];
  $: flatItems = groupedItems.flatMap((group) => group.items);
  $: {
    if (flatItems.length === 0) {
      selectedIndex = -1;
    } else if (
      selectedIndex < 0 ||
      selectedIndex >= flatItems.length ||
      flatItems[selectedIndex]?.disabled
    ) {
      selectedIndex = getFirstSelectableIndex(flatItems);
    }
  }

  onMount(async () => {
    await tick();
    inputElement?.focus();
  });
</script>

<div
  class="modal-overlay"
  data-testid="command-palette-modal"
  transition:motion={{ preset: "fade", reducedMotion: $prefersReducedMotion }}
>
  <div
    class="modal-panel"
    role="dialog"
    aria-modal="true"
    transition:motion={{ preset: "modal", reducedMotion: $prefersReducedMotion }}
  >
    <header class="modal-header">
      <div class="modal-title">Command palette</div>
      <button
        class="icon-button"
        type="button"
        aria-label="Close command palette"
        on:click={onClose}
      >
        <X aria-hidden="true" size={16} />
      </button>
    </header>

    <div class="palette-input-row">
      <input
        class="palette-input"
        type="search"
        placeholder="Type a command or search notes"
        bind:this={inputElement}
        value={query}
        aria-label="Command palette"
        on:input={(event) => {
          const target = event.currentTarget;
          if (target instanceof HTMLInputElement) {
            query = target.value;
          }
        }}
        on:keydown={handleKeydown}
      />
    </div>

    <div class="palette-results" role="listbox" data-testid="command-palette-results">
      {#if flatItems.length === 0}
        <div class="results-empty">No matches.</div>
      {:else}
        {#each groupedItems as group (group.group)}
          {#if group.items.length > 0}
            <div class="palette-group" aria-label={group.group}>
              <div class="palette-group-title">{group.group}</div>
              <div class="palette-group-items">
        {#each group.items as item (item.type + item.id)}
                  <button
                    id={`palette-item-${item.type}-${item.id}`}
                    class={`palette-row${flatItems[selectedIndex] === item ? " selected" : ""}${item.disabled ? " disabled" : ""}`}
                    type="button"
                    role="option"
                    aria-selected={flatItems[selectedIndex] === item}
                    aria-disabled={item.disabled}
                    data-testid={`palette-item-${item.type}-${item.id}`}
                    data-selected={flatItems[selectedIndex] === item}
                    on:click={() => handleClick(item)}
                  >
                    <div class="palette-row-main">
                      <div class="palette-row-title">
                        {#if item.type === "note"}
                          {item.title}
                        {:else}
                          {item.label}
                        {/if}
                      </div>
                      {#if item.type === "note"}
                        <div class="palette-row-subtitle">{item.subtitle}</div>
                      {:else if item.disabled}
                        <div class="palette-row-subtitle">Unavailable</div>
                      {/if}
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 12px;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(10px) saturate(1.1);
    z-index: 100;
  }

  .modal-panel {
    margin-top: 48px;
    width: min(640px, 100% - 24px);
    background: var(--bg-1);
    border-radius: var(--r-lg);
    border: 1px solid var(--stroke-0);
    box-shadow: var(--shadow-panel);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    z-index: 110;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .modal-title {
    font-weight: 500;
  }

  .icon-button {
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: var(--r-md);
    border: none;
    background: transparent;
    color: var(--text-1);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
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

  .palette-input-row {
    display: flex;
  }

  .palette-input {
    width: 100%;
    height: 32px;
    padding: 0 12px;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-2);
    color: var(--text-0);
  }

  .palette-input::placeholder {
    color: var(--text-2);
  }

  .palette-input:focus {
    border-color: rgba(255, 138, 42, 0.4);
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .palette-results {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 360px;
    overflow: auto;
  }

  .palette-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .palette-group-title {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-2);
  }

  .palette-group-items {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .palette-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-0);
    cursor: pointer;
    text-align: left;
  }

  .palette-row:hover {
    background: var(--bg-3);
  }

  .palette-row.selected {
    background: var(--accent-2);
    border-color: var(--accent-2);
  }

  .palette-row.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .palette-row.disabled:hover {
    background: transparent;
  }

  .palette-row-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1;
  }

  .palette-row-title {
    font-size: 13px;
    color: var(--text-0);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .palette-row-subtitle {
    font-size: 12px;
    color: var(--text-2);
  }

  .results-empty {
    color: var(--text-2);
    font-size: 13px;
    padding: 12px;
  }

  @media (max-width: 767px) {
    .modal-panel {
      margin-top: 16px;
      padding: 16px;
    }
  }
</style>
