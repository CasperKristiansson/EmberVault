<script lang="ts">
  import { afterUpdate } from "svelte";
  import type { FolderTree } from "$lib/core/storage/types";
  import type { SvelteSet } from "svelte/reactivity";
  import { getChildFolderIds } from "$lib/core/utils/folder-tree";

  export let folderId: string;
  export let folders: FolderTree;
  export let depth = 0;
  export let expandedIds: SvelteSet<string>;
  export let activeFolderId: string | null = null;
  export let editingFolderId: string | null = null;
  export let draftName = "";
  export let onToggle: (folderId: string) => void = () => {};
  export let onSelect: (folderId: string) => void = () => {};
  export let onContextMenu: (folderId: string, event: MouseEvent) => void =
    () => {};
  export let onCommitRename: () => void = () => {};
  export let onCancelRename: () => void = () => {};

  $: folder = folders[folderId];
  $: childFolderIds = getChildFolderIds(folderId, folders);
  $: hasChildren = childFolderIds.length > 0;
  $: isExpanded = expandedIds.has(folderId);
  $: isEditing = editingFolderId === folderId;
  $: isActive = activeFolderId === folderId;

  let renameInput: HTMLInputElement | null = null;
  let wasEditing = false;

  afterUpdate(() => {
    if (isEditing && renameInput && !wasEditing) {
      renameInput.focus();
      renameInput.select();
    }
    wasEditing = isEditing;
  });

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      onCommitRename();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancelRename();
    }
  };

  const handleSelect = (): void => {
    if (isEditing) {
      return;
    }
    onSelect(folderId);
  };

  const handleRowKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect();
    }
  };
</script>

{#if folder}
  <div
    class="folder-row"
    class:active={isActive}
    style={`--depth:${depth}`}
    data-testid={`folder-row-${folderId}`}
    role="treeitem"
    aria-selected={isActive ? "true" : "false"}
    tabindex="0"
    on:click={handleSelect}
    on:keydown={handleRowKeydown}
    on:contextmenu|preventDefault|stopPropagation={event =>
      onContextMenu(folderId, event)}
  >
    {#if hasChildren}
      <button
        class="folder-chevron"
        type="button"
        aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
        on:click={() => onToggle(folderId)}
      >
        {isExpanded ? "v" : ">"}
      </button>
    {:else}
      <span class="folder-chevron spacer" aria-hidden="true"></span>
    {/if}

    {#if isEditing}
      <input
        class="folder-input"
        type="text"
        bind:value={draftName}
        bind:this={renameInput}
        data-testid="folder-rename-input"
        aria-label="Rename folder"
        on:keydown={handleKeydown}
        on:blur={onCommitRename}
      />
    {:else}
      <span class="folder-label">{folder.name}</span>
    {/if}
  </div>

  {#if hasChildren && isExpanded}
    <div class="folder-children">
      {#each childFolderIds as childId (childId)}
        <svelte:self
          folderId={childId}
          {folders}
          {expandedIds}
          {activeFolderId}
          {editingFolderId}
          bind:draftName={draftName}
          {onToggle}
          {onSelect}
          {onContextMenu}
          {onCommitRename}
          {onCancelRename}
          depth={depth + 1}
        />
      {/each}
    </div>
  {/if}
{/if}

<style>
  .folder-row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 8px 0 calc(8px + var(--depth) * 12px);
    border-radius: var(--r-sm);
    color: var(--text-0);
    cursor: pointer;
    position: relative;
  }

  .folder-row:hover {
    background: var(--bg-3);
  }

  .folder-row.active {
    background: var(--accent-2);
  }

  .folder-row.active::before {
    content: "";
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 3px;
    background: var(--accent-0);
    border-radius: 3px;
  }

  .folder-chevron {
    width: 16px;
    height: 16px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-1);
    cursor: pointer;
  }

  .folder-chevron:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .folder-chevron.spacer {
    display: inline-block;
  }

  .folder-label {
    font-size: 13px;
    color: var(--text-1);
  }

  .folder-row.active .folder-label {
    color: var(--text-0);
  }

  .folder-input {
    flex: 1;
    height: 28px;
    padding: 0 8px;
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-sm);
    color: var(--text-0);
  }

  .folder-input:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .folder-children {
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 767px) {
    .folder-row {
      height: 40px;
    }
  }
</style>
