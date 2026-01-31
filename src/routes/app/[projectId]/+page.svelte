<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/stores";
  import AppShell from "$lib/components/AppShell.svelte";
  import ModalHost from "$lib/components/modals/ModalHost.svelte";
  import TiptapEditor from "$lib/components/editor/TiptapEditor.svelte";
  import NoteListVirtualized from "$lib/components/notes/NoteListVirtualized.svelte";
  import FolderTree from "$lib/components/sidebar/FolderTree.svelte";
  import ProjectSwitcher from "$lib/components/sidebar/ProjectSwitcher.svelte";
  import { createEmptyDocument } from "$lib/core/editor/tiptap-config";
  import {
    addFolder,
    isFolderEmpty,
    removeFolder,
    renameFolder as renameFolderEntry,
  } from "$lib/core/utils/folder-tree";
  import { filterNotesByFolder } from "$lib/core/utils/notes-filter";
  import { createUlid } from "$lib/core/utils/ulid";
  import { createDebouncedTask } from "$lib/core/utils/debounce";
  import { hashBlobSha256 } from "$lib/core/utils/hash";
  import {
    addTab,
    closeTabState,
    reorderTabs,
  } from "$lib/core/utils/tabs";
  import {
    applySearchIndexChange,
    hydrateSearchIndex,
    type SearchIndexState,
  } from "$lib/state/search.store";
  import { openModal } from "$lib/state/ui.store";
  import {
    resolveMobileView,
    type MobileView,
  } from "$lib/core/utils/mobile-view";
  import { IndexedDBAdapter } from "$lib/core/storage/indexeddb.adapter";
  import type {
    AssetMeta,
    NoteDocumentFile,
    NoteIndexEntry,
    Project,
  } from "$lib/core/storage/types";

  const adapter = new IndexedDBAdapter();

  let project: Project | null = null;
  let projects: Project[] = [];
  let notes: NoteIndexEntry[] = [];
  let activeNote: NoteDocumentFile | null = null;
  let tabs: string[] = [];
  let activeTabId: string | null = null;
  let tabTitles: Record<string, string> = {};
  let draggingTabId: string | null = null;
  let dropTargetTabId: string | null = null;
  let titleValue = "";
  let editorContent = createEmptyDocument();
  let editorPlainText = "";
  let isLoading = true;
  let saveState: "idle" | "saving" | "saved" = "idle";
  let mobileView: MobileView = "notes";
  let activeFolderId: string | null = null;
  let searchState: SearchIndexState | null = null;

  const saveDelay = 400;
  let saveToken = 0;

  let projectId = "";
  $: projectId = $page.params.projectId ?? "";

  const toDerivedMarkdown = (title: string, body: string): string => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      return body;
    }
    if (body.trim().length === 0) {
      return `# ${trimmedTitle}`;
    }
    return `# ${trimmedTitle}\n\n${body}`;
  };

  const createNoteDocument = (): NoteDocumentFile => {
    const timestamp = Date.now();
    return {
      id: createUlid(),
      title: "",
      createdAt: timestamp,
      updatedAt: timestamp,
      folderId: activeFolderId,
      tagIds: [],
      favorite: false,
      deletedAt: null,
      customFields: {},
      pmDoc: createEmptyDocument(),
      derived: {
        plainText: "",
        outgoingLinks: [],
      },
    };
  };

  const readImageMeta = async (file: Blob): Promise<AssetMeta> => {
    const meta: AssetMeta = {
      mime: file.type,
      size: file.size,
    };
    if (!("createImageBitmap" in window)) {
      return meta;
    }
    try {
      const bitmap = await createImageBitmap(file);
      meta.width = bitmap.width;
      meta.height = bitmap.height;
      bitmap.close();
    } catch {
      return meta;
    }
    return meta;
  };

  const handleImagePaste = async (
    file: File | Blob
  ): Promise<{
    assetId: string;
    src: string;
    alt?: string;
    mime?: string;
    width?: number;
    height?: number;
  } | null> => {
    if (!projectId) {
      return null;
    }
    const assetId = await hashBlobSha256(file);
    const meta = await readImageMeta(file);
    await adapter.writeAsset({
      projectId,
      assetId,
      blob: file,
      meta,
    });
    const src = URL.createObjectURL(file);
    const altText = file instanceof File ? file.name : "Pasted image";
    return {
      assetId,
      src,
      alt: altText,
      mime: meta.mime,
      width: meta.width,
      height: meta.height,
    };
  };

  const setActiveNote = (note: NoteDocumentFile | null): void => {
    activeNote = note;
    titleValue = note?.title ?? "";
    editorContent = note?.pmDoc ?? createEmptyDocument();
    editorPlainText = note?.derived?.plainText ?? "";
    saveState = note ? "saved" : "idle";
  };

  const getTabTitle = (
    noteId: string,
    titles: Record<string, string>
  ): string => {
    const storedTitle = titles[noteId];
    if (storedTitle !== undefined) {
      return storedTitle.trim() || "Untitled";
    }
    return "Untitled";
  };

  const setMobileView = (view: MobileView): void => {
    mobileView = resolveMobileView(view, Boolean(activeNote));
  };

  const openGlobalSearch = (): void => {
    openModal("global-search");
  };

  const openCommandPalette = (): void => {
    openModal("command-palette");
  };

  const sortNotes = (list: NoteIndexEntry[]): NoteIndexEntry[] =>
    [...list].sort((first, second) => second.updatedAt - first.updatedAt);

  $: activeFolderName =
    activeFolderId && project
      ? project.folders[activeFolderId]?.name ?? null
      : null;
  $: displayNotes = filterNotesByFolder(notes, activeFolderId);
  $: noteListTitle = project
    ? `${project.name} / ${activeFolderName ?? "All notes"}`
    : "Notes";
  $: noteListCount = displayNotes.length;

  const loadNotes = async (): Promise<void> => {
    if (!projectId) {
      return;
    }
    notes = sortNotes(await adapter.listNotes(projectId));
  };

  const loadProjects = async (): Promise<void> => {
    projects = await adapter.listProjects();
  };

  const loadNoteDocumentsForIndex = async (): Promise<NoteDocumentFile[]> => {
    if (!projectId || notes.length === 0) {
      return [];
    }
    const noteDocuments = await Promise.all(
      notes.map(async (entry) => adapter.readNote(projectId, entry.id))
    );
    return noteDocuments.filter(
      (note): note is NoteDocumentFile =>
        note !== null && note.deletedAt === null
    );
  };

  const loadSearchIndex = async (): Promise<void> => {
    if (!projectId) {
      return;
    }
    const noteDocuments = await loadNoteDocumentsForIndex();
    searchState = await hydrateSearchIndex(
      adapter,
      projectId,
      noteDocuments
    );
  };

  const updateSearchIndexForNote = async (
    note: NoteDocumentFile
  ): Promise<void> => {
    if (!projectId) {
      return;
    }
    if (!searchState) {
      await loadSearchIndex();
    }
    if (!searchState) {
      return;
    }
    searchState = await applySearchIndexChange({
      adapter,
      projectId,
      state: searchState,
      change: {
        type: "upsert",
        note,
      },
    });
  };


  const persistProject = async (nextProject: Project): Promise<void> => {
    project = nextProject;
    projects = projects.some(current => current.id === nextProject.id)
      ? projects.map(current =>
          current.id === nextProject.id ? nextProject : current
        )
      : [...projects, nextProject];
    await adapter.writeProject(nextProject.id, nextProject);
  };

  const loadNote = async (noteId: string): Promise<void> => {
    await flushPendingSave();
    const note = await adapter.readNote(projectId, noteId);
    if (note) {
      setActiveNote(note);
      tabTitles = { ...tabTitles, [note.id]: note.title ?? "" };
    }
  };

  const activateTab = async (noteId: string): Promise<void> => {
    if (!noteId) {
      return;
    }
    tabs = addTab(tabs, noteId);
    activeTabId = noteId;
    await loadNote(noteId);
  };

  const handleCloseTab = async (noteId: string): Promise<void> => {
    const wasActive = noteId === activeTabId;
    if (wasActive) {
      await flushPendingSave();
    }
    const nextState = closeTabState({ tabs, activeTabId }, noteId);
    tabs = nextState.tabs;
    activeTabId = nextState.activeTabId;
    if (noteId in tabTitles) {
      const { [noteId]: _closedTitle, ...rest } = tabTitles;
      tabTitles = rest;
    }
    if (!wasActive) {
      return;
    }
    if (activeTabId) {
      await loadNote(activeTabId);
      return;
    }
    setActiveNote(null);
  };

  const handleTabKeydown = (
    event: KeyboardEvent,
    noteId: string
  ): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void activateTab(noteId);
    }
  };

  const handleTabDragStart = (
    event: DragEvent,
    noteId: string
  ): void => {
    draggingTabId = noteId;
    dropTargetTabId = null;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", noteId);
    }
  };

  const handleTabDragOver = (event: DragEvent, noteId: string): void => {
    if (!draggingTabId || draggingTabId === noteId) {
      return;
    }
    event.preventDefault();
    dropTargetTabId = noteId;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  };

  const handleTabDrop = (event: DragEvent, noteId: string): void => {
    event.preventDefault();
    const draggedId =
      draggingTabId || event.dataTransfer?.getData("text/plain") || "";
    if (!draggedId || draggedId === noteId) {
      dropTargetTabId = null;
      return;
    }
    tabs = reorderTabs(tabs, draggedId, noteId);
    dropTargetTabId = null;
  };

  const handleTabDragEnd = (): void => {
    draggingTabId = null;
    dropTargetTabId = null;
  };

  const persistNote = async (note: NoteDocumentFile): Promise<void> => {
    await adapter.writeNote({
      projectId,
      noteId: note.id,
      noteDocument: note,
      derivedMarkdown: toDerivedMarkdown(
        note.title,
        note.derived?.plainText ?? ""
      ),
    });
    await updateSearchIndexForNote(note);
  };

  const debouncedSave = createDebouncedTask(
    async (noteSnapshot: NoteDocumentFile, token: number) => {
      await persistNote(noteSnapshot);
      await loadNotes();
      if (token === saveToken) {
        saveState = "saved";
      }
    },
    saveDelay
  );

  const scheduleSave = (note: NoteDocumentFile): void => {
    saveState = "saving";
    const token = (saveToken += 1);
    const noteSnapshot = structuredClone(note);
    debouncedSave.schedule(noteSnapshot, token);
  };

  const flushPendingSave = async (): Promise<void> => {
    if (!debouncedSave.pending()) {
      return;
    }
    await debouncedSave.flush();
  };

  const applyEdits = (
    pmDoc: Record<string, unknown> | null = null,
    plainText: string | null = null
  ): void => {
    if (!activeNote) {
      return;
    }
    const timestamp = Date.now();
    const resolvedTitle = titleValue.trim();
    const resolvedDoc = pmDoc ?? activeNote.pmDoc ?? createEmptyDocument();
    const resolvedPlainText = plainText ?? editorPlainText;
    const updatedNote: NoteDocumentFile = {
      ...activeNote,
      title: resolvedTitle,
      updatedAt: timestamp,
      pmDoc: resolvedDoc,
      derived: {
        plainText: resolvedPlainText,
        outgoingLinks: activeNote.derived?.outgoingLinks ?? [],
      },
    };
    activeNote = updatedNote;
    tabTitles = { ...tabTitles, [updatedNote.id]: resolvedTitle };
    scheduleSave(updatedNote);
  };

  const handleTitleInput = (event: Event): void => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    titleValue = target.value;
    applyEdits();
  };

  const handleEditorUpdate = (payload: {
    json: Record<string, unknown>;
    text: string;
  }): void => {
    editorPlainText = payload.text;
    applyEdits(payload.json, payload.text);
  };

  const createNote = async (): Promise<void> => {
    await flushPendingSave();
    const note = createNoteDocument();
    setActiveNote(note);
    tabs = addTab(tabs, note.id);
    activeTabId = note.id;
    tabTitles = { ...tabTitles, [note.id]: note.title ?? "" };
    saveState = "saving";
    await persistNote(note);
    await loadNotes();
    saveState = "saved";
  };

  const createFolder = async (parentId: string | null): Promise<string | null> => {
    if (!project) {
      return null;
    }
    const folderId = createUlid();
    const nextFolders = addFolder(project.folders, {
      id: folderId,
      name: "New folder",
      parentId,
    });
    const updatedProject: Project = {
      ...project,
      folders: nextFolders,
      updatedAt: Date.now(),
    };
    await persistProject(updatedProject);
    return folderId;
  };

  const renameFolder = async (
    folderId: string,
    name: string
  ): Promise<void> => {
    if (!project) {
      return;
    }
    const nextFolders = renameFolderEntry(project.folders, folderId, name);
    if (nextFolders === project.folders) {
      return;
    }
    const updatedProject: Project = {
      ...project,
      folders: nextFolders,
      updatedAt: Date.now(),
    };
    await persistProject(updatedProject);
  };

  const deleteFolder = async (folderId: string): Promise<void> => {
    if (!project) {
      return;
    }
    if (!isFolderEmpty(folderId, project.folders, project.notesIndex)) {
      return;
    }
    const nextFolders = removeFolder(project.folders, folderId);
    const updatedProject: Project = {
      ...project,
      folders: nextFolders,
      updatedAt: Date.now(),
    };
    await persistProject(updatedProject);
    if (activeFolderId === folderId) {
      activeFolderId = null;
    }
  };

  const switchProject = async (nextProjectId: string): Promise<void> => {
    if (!nextProjectId || nextProjectId === projectId) {
      return;
    }
    await flushPendingSave();
    const currentState = (await adapter.readUIState()) ?? {};
    await adapter.writeUIState({
      ...currentState,
      lastProjectId: nextProjectId,
    });
    activeFolderId = null;
    await goto(resolve("/app/[projectId]", { projectId: nextProjectId }));
  };

  const selectFolder = (folderId: string): void => {
    activeFolderId = folderId;
  };

  onMount(() => {
    const initialize = async (): Promise<void> => {
      await adapter.init();
      if (!projectId) {
        isLoading = false;
        return;
      }
      const storedProject = await adapter.readProject(projectId);
      if (!storedProject) {
        await goto(resolve("/onboarding"));
        return;
      }
      project = storedProject;
      await loadProjects();
      await loadNotes();
      await loadSearchIndex();
      if (notes.length > 0) {
        await activateTab(notes[0]?.id ?? "");
      } else {
        tabs = [];
        activeTabId = null;
        tabTitles = {};
        setActiveNote(null);
      }
      activeFolderId = null;
      isLoading = false;
    };
    void initialize();

    const handleGlobalShortcut = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "k" && !event.shiftKey) {
        event.preventDefault();
        openCommandPalette();
        return;
      }
      if (key === "f" && event.shiftKey) {
        event.preventDefault();
        openGlobalSearch();
      }
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") {
        void flushPendingSave();
      }
    };

    const handleBeforeUnload = (): void => {
      void flushPendingSave();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleGlobalShortcut);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleGlobalShortcut);
    };
  });

  $: {
    const resolvedView = resolveMobileView(mobileView, Boolean(activeNote));
    if (resolvedView !== mobileView) {
      mobileView = resolvedView;
    }
  }
</script>

<AppShell {saveState} {mobileView}>
  <div slot="topbar" class="topbar-content">
    <div
      class="topbar-tabs"
      role="tablist"
      aria-label="Open notes"
      data-testid="tab-list"
    >
      {#each tabs as tabId (tabId)}
        <div
          class="tab"
          role="tab"
          tabindex={tabId === activeTabId ? 0 : -1}
          aria-selected={tabId === activeTabId}
          data-testid="tab-item"
          data-note-id={tabId}
          data-active={tabId === activeTabId}
          data-drop-target={dropTargetTabId === tabId}
          data-dragging={draggingTabId === tabId}
          draggable="true"
          on:click={() => void activateTab(tabId)}
          on:keydown={event => handleTabKeydown(event, tabId)}
          on:dragstart={event => handleTabDragStart(event, tabId)}
          on:dragover={event => handleTabDragOver(event, tabId)}
          on:drop={event => handleTabDrop(event, tabId)}
          on:dragend={handleTabDragEnd}
        >
          <span class="tab-title" data-testid="tab-title">
            {getTabTitle(tabId, tabTitles)}
          </span>
          <button
            class="tab-close"
            type="button"
            aria-label="Close tab"
            data-testid="tab-close"
            data-note-id={tabId}
            draggable="false"
            on:click|stopPropagation={() => void handleCloseTab(tabId)}
          >
            <svg
              class="tab-close-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M6 6 18 18" />
              <path d="M6 18 18 6" />
            </svg>
          </button>
        </div>
      {/each}
    </div>
    <div class="topbar-actions">
      <button class="icon-button" type="button">Outline</button>
      <button class="icon-button" type="button">Backlinks</button>
      <button class="icon-button" type="button">Metadata</button>
    </div>
  </div>

  <div slot="sidebar" class="sidebar-content">
    <ProjectSwitcher
      {projects}
      activeProjectId={project?.id ?? projectId}
      onSelect={switchProject}
    />
    <FolderTree
      folders={project?.folders ?? {}}
      notesIndex={project?.notesIndex ?? {}}
      {activeFolderId}
      onSelect={selectFolder}
      onCreate={createFolder}
      onRename={renameFolder}
      onDelete={deleteFolder}
    />
  </div>

  <div slot="note-list" class="note-list-content">
    <header class="note-list-header">
      <div>
        <div class="note-list-title">{noteListTitle}</div>
        <div class="note-list-subtitle">{noteListCount} total</div>
      </div>
      <div class="note-list-actions">
        <button
          class="icon-button"
          type="button"
          data-testid="open-global-search"
          aria-label="Open global search"
          on:click={openGlobalSearch}
        >
          <svg
            class="icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>
        <button
          class="button primary"
          data-testid="new-note"
          on:click={createNote}
          disabled={isLoading}
        >
          New note
        </button>
      </div>
    </header>

    {#if isLoading}
      <div class="note-list-empty">Loading notes...</div>
    {:else if displayNotes.length === 0}
      <div class="note-list-empty">No notes yet.</div>
    {:else}
      <NoteListVirtualized
        notes={displayNotes}
        activeNoteId={activeTabId}
        onSelect={noteId => void activateTab(noteId)}
      />
    {/if}
  </div>

  <div slot="editor" class="editor-content">
    {#if isLoading}
      <div class="editor-empty">Preparing editor...</div>
    {:else if !activeNote}
      <div class="editor-empty">Select a note to start writing.</div>
    {:else}
      <div class="editor-header">
        <input
          class="title-input field-input"
          data-testid="note-title"
          type="text"
          placeholder="Untitled"
          value={titleValue}
          on:input={handleTitleInput}
          aria-label="Note title"
        />
        <div class="chips-row" aria-label="Metadata chips"></div>
      </div>

      <div class="field field-body">
        <span class="field-label">Content</span>
        <TiptapEditor
          content={editorContent}
          ariaLabel="Note content"
          dataTestId="note-body"
          onImagePaste={handleImagePaste}
          onUpdate={handleEditorUpdate}
        />
      </div>
    {/if}
  </div>

  <div slot="right-panel" class="right-panel-content">
    <div class="right-panel-title">Right panel</div>
    <div class="right-panel-subtitle">Outline · Backlinks · Metadata</div>
    <p class="right-panel-body">
      Panels will appear here as the editor grows.
    </p>
  </div>

  <ModalHost
    slot="modal"
    {project}
    {projects}
    notes={notes}
    activeNoteId={activeTabId}
    {searchState}
    onOpenNote={activateTab}
    onCreateNote={createNote}
    onOpenGlobalSearch={openGlobalSearch}
    onProjectChange={switchProject}
  />

  <div slot="bottom-nav" class="mobile-nav-content">
    <button
      class="mobile-nav-button"
      class:active={mobileView === "notes"}
      type="button"
      data-testid="mobile-nav-notes"
      aria-pressed={mobileView === "notes"}
      on:click={() => setMobileView("notes")}
    >
      Notes
    </button>
    {#if activeNote}
      <button
        class="mobile-nav-button"
        class:active={mobileView === "editor"}
        type="button"
        data-testid="mobile-nav-editor"
        aria-pressed={mobileView === "editor"}
        on:click={() => setMobileView("editor")}
      >
        Editor
      </button>
    {/if}
    <button
      class="mobile-nav-button"
      type="button"
      data-testid="mobile-nav-search"
      aria-disabled="true"
      disabled
    >
      Search
    </button>
    <button
      class="mobile-nav-button"
      type="button"
      data-testid="mobile-nav-graph"
      aria-disabled="true"
      disabled
    >
      Graph
    </button>
    <button
      class="mobile-nav-button"
      type="button"
      data-testid="mobile-nav-settings"
      aria-disabled="true"
      disabled
    >
      Settings
    </button>
  </div>
</AppShell>

<style>
  .topbar-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 16px;
  }

  .topbar-tabs {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    padding: 2px 0;
  }

  .tab {
    height: 32px;
    padding: 0 8px 0 12px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-1);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    user-select: none;
    max-width: 220px;
  }

  .tab[data-active="true"] {
    background: var(--bg-2);
    border-color: var(--stroke-0);
    color: var(--text-0);
  }

  .tab:hover,
  .tab[data-drop-target="true"] {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .tab:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .tab[data-dragging="true"] {
    opacity: 0.6;
  }

  .tab-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tab-close {
    height: 20px;
    width: 20px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    color: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    cursor: pointer;
  }

  .tab:hover .tab-close,
  .tab[data-active="true"] .tab-close {
    opacity: 1;
    pointer-events: auto;
  }

  .tab-close:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .tab-close-icon {
    width: 14px;
    height: 14px;
    display: block;
  }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .icon-button {
    height: 32px;
    padding: 0 10px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-1);
    cursor: pointer;
  }

  .icon-button:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .icon {
    width: 16px;
    height: 16px;
    display: block;
  }

  .sidebar-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    font-size: 13px;
    flex: 1;
    min-height: 0;
  }

  .note-list-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    min-height: 0;
  }

  .note-list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .note-list-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .note-list-title {
    font-weight: 500;
  }

  .note-list-subtitle {
    font-size: 12px;
    color: var(--text-2);
  }

  .note-list-empty {
    color: var(--text-2);
    font-size: 13px;
  }

  .editor-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .editor-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .title-input {
    font-size: 22px;
    font-weight: 500;
    line-height: 1.2;
  }

  .chips-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .editor-empty {
    color: var(--text-2);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 12px;
    color: var(--text-2);
  }

  .field-input,
  .field-input {
    width: 100%;
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    color: var(--text-0);
    padding: 8px 12px;
  }

  .field-input:focus,
  .field-input:focus {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .button {
    height: 32px;
    padding: 0 14px;
    border-radius: var(--r-md);
    border: 1px solid transparent;
    cursor: pointer;
  }

  .button.primary {
    background: var(--accent-0);
    color: #0b0d10;
  }

  .button.primary:hover:enabled {
    background: var(--accent-1);
  }

  .button.primary:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .right-panel-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .right-panel-title {
    font-weight: 500;
  }

  .right-panel-subtitle {
    font-size: 12px;
    color: var(--text-2);
  }

  .right-panel-body {
    margin: 0;
    font-size: 13px;
    color: var(--text-1);
  }

  .mobile-nav-content {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .mobile-nav-button {
    flex: 1;
    height: 40px;
    border-radius: var(--r-md);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-1);
    font-size: 12px;
    cursor: pointer;
  }

  .mobile-nav-button.active {
    background: var(--accent-2);
    color: var(--accent-0);
  }

  .mobile-nav-button:disabled {
    color: var(--text-2);
    cursor: not-allowed;
    opacity: 0.7;
  }

</style>
