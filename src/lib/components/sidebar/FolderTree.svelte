<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import type {
    FolderTree,
    NoteIndexEntry,
  } from "$lib/core/storage/types";
  import {
    getRootFolderIds,
    isFolderEmpty,
  } from "$lib/core/utils/folder-tree";
  import FolderTreeNode from "./FolderTreeNode.svelte";

  export let folders: FolderTree = {};
  export let notesIndex: Record<string, NoteIndexEntry> = {};
  export let activeFolderId: string | null = null;
  export let onSelect: (folderId: string) => void = () => {};
  export let onCreate: (parentId: string | null) => Promise<string | null> =
    async () => null;
  export let onRename: (folderId: string, name: string) => Promise<void> =
    async () => {};
  export let onDelete: (folderId: string) => Promise<void> = async () => {};

  let expandedIds = new SvelteSet<string>();
  let editingFolderId: string | null = null;
  let draftName = "";

  let menuOpen = false;
  let menuX = 0;
  let menuY = 0;
  let menuFolderId: string | null = null;
  let menuElement: HTMLDivElement | null = null;

  let rootFolderIds: string[] = [];

  $: rootFolderIds = getRootFolderIds(folders);

  const toggleFolder = (folderId: string): void => {
    if (expandedIds.has(folderId)) {
      expandedIds.delete(folderId);
    } else {
      expandedIds.add(folderId);
    }
  };

  const openMenu = (folderId: string | null, event: MouseEvent): void => {
    menuOpen = true;
    menuFolderId = folderId;
    menuX = event.clientX;
    menuY = event.clientY;
  };

  const closeMenu = (): void => {
    menuOpen = false;
    menuFolderId = null;
  };

  const startRename = (folderId: string): void => {
    editingFolderId = folderId;
    draftName = folders[folderId]?.name ?? "";
  };

  const cancelRename = (): void => {
    editingFolderId = null;
    draftName = "";
  };

  const commitRename = async (): Promise<void> => {
    if (!editingFolderId) {
      return;
    }
    const resolvedName = draftName.trim();
    if (resolvedName.length > 0) {
      await onRename(editingFolderId, resolvedName);
    }
    editingFolderId = null;
  };

  const handleCreate = async (parentId: string | null): Promise<void> => {
    closeMenu();
    const createdId = await onCreate(parentId);
    if (!createdId) {
      return;
    }
    if (parentId) {
      expandedIds.add(parentId);
    }
    startRename(createdId);
  };

  const handleRename = (): void => {
    const targetId = menuFolderId;
    if (!targetId) {
      return;
    }
    closeMenu();
    startRename(targetId);
  };

  const handleDelete = async (): Promise<void> => {
    const targetId = menuFolderId;
    if (!targetId) {
      return;
    }
    closeMenu();
    await onDelete(targetId);
  };

  const isDeleteDisabled = (): boolean => {
    if (!menuFolderId) {
      return true;
    }
    return !isFolderEmpty(menuFolderId, folders, notesIndex);
  };

  onMount(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuOpen) {
        return;
      }
      if (menuElement && menuElement.contains(event.target as Node)) {
        return;
      }
      closeMenu();
    };
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeydown);
    };
  });
</script>

<div
  class="folder-tree"
  data-testid="folder-tree"
  role="tree"
  tabindex="0"
  on:contextmenu|preventDefault={event => openMenu(null, event)}
>
  {#if rootFolderIds.length === 0}
    <div class="folder-empty" data-testid="folder-empty">
      No folders yet. Right-click to add one.
    </div>
  {:else}
    {#each rootFolderIds as folderId (folderId)}
      <FolderTreeNode
        {folderId}
        {folders}
        {expandedIds}
        {activeFolderId}
        {editingFolderId}
        bind:draftName={draftName}
        onToggle={toggleFolder}
        onContextMenu={openMenu}
        onCommitRename={commitRename}
        onCancelRename={cancelRename}
        onSelect={onSelect}
      />
    {/each}
  {/if}
</div>

{#if menuOpen}
  <div
    class="folder-menu"
    data-testid="folder-menu"
    bind:this={menuElement}
    style={`left:${menuX}px; top:${menuY}px;`}
  >
    <button
      class="folder-menu-item"
      type="button"
      data-testid="folder-menu-new"
      on:click={() => handleCreate(menuFolderId)}
    >
      New folder
    </button>
    {#if menuFolderId}
      <button
        class="folder-menu-item"
        type="button"
        data-testid="folder-menu-rename"
        on:click={handleRename}
      >
        Rename
      </button>
      <button
        class="folder-menu-item"
        type="button"
        data-testid="folder-menu-delete"
        on:click={handleDelete}
        disabled={isDeleteDisabled()}
      >
        Delete
      </button>
    {/if}
  </div>
{/if}

<style>
  .folder-tree {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: auto;
    padding-right: 4px;
  }

  .folder-empty {
    color: var(--text-2);
    font-size: 12px;
    padding: 8px 4px;
  }

  .folder-menu {
    position: fixed;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 160px;
    padding: 8px;
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-popover);
  }

  .folder-menu-item {
    height: 32px;
    padding: 0 10px;
    border-radius: var(--r-sm);
    border: none;
    background: transparent;
    color: var(--text-0);
    text-align: left;
    cursor: pointer;
  }

  .folder-menu-item:hover:enabled {
    background: var(--bg-3);
  }

  .folder-menu-item:disabled {
    color: var(--text-2);
    cursor: not-allowed;
  }
</style>
