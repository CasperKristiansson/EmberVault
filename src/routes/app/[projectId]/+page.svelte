<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/stores";
  import AppShell from "$lib/components/AppShell.svelte";
  import GraphView from "$lib/components/graph/GraphView.svelte";
  import RightPanel from "$lib/components/rightpanel/RightPanel.svelte";
  import RightPanelTabs from "$lib/components/rightpanel/RightPanelTabs.svelte";
  import ModalHost from "$lib/components/modals/ModalHost.svelte";
  import TiptapEditor from "$lib/components/editor/TiptapEditor.svelte";
  import NoteListVirtualized from "$lib/components/notes/NoteListVirtualized.svelte";
  import FolderTree from "$lib/components/sidebar/FolderTree.svelte";
  import ProjectSwitcher from "$lib/components/sidebar/ProjectSwitcher.svelte";
  import { createEmptyDocument } from "$lib/core/editor/tiptap-config";
  import {
    buildBacklinkSnippet,
    resolveLinkedMentions,
    type BacklinkSnippet,
  } from "$lib/core/editor/links/backlinks";
  import { resolveOutgoingLinks } from "$lib/core/editor/links/parse";
  import type { WikiLinkCandidate } from "$lib/core/editor/wiki-links";
  import {
    addFolder,
    isFolderEmpty,
    removeFolder,
    renameFolder as renameFolderEntry,
  } from "$lib/core/utils/folder-tree";
  import {
    orderNotesForFolder,
    reorderNoteIds,
    resolveFolderNoteOrder,
    setFolderNoteOrder,
  } from "$lib/core/utils/note-order";
  import { createUlid } from "$lib/core/utils/ulid";
  import { createDebouncedTask } from "$lib/core/utils/debounce";
  import { hashBlobSha256 } from "$lib/core/utils/hash";
  import {
    addTab,
    closeTabState,
    moveTabBetweenPanes,
    reorderTabs,
  } from "$lib/core/utils/tabs";
  import { resolveSecondaryNoteId } from "$lib/core/utils/split-view";
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
    UIState,
  } from "$lib/core/storage/types";

  const adapter = new IndexedDBAdapter();

  type PaneId = "primary" | "secondary";

  type PaneState = {
    tabs: string[];
    activeTabId: string | null;
    note: NoteDocumentFile | null;
    titleValue: string;
    editorContent: Record<string, unknown>;
    editorPlainText: string;
  };

  type RightPanelTab = "outline" | "backlinks" | "metadata";

  type BacklinkEntry = {
    id: string;
    title: string;
    snippet: BacklinkSnippet | null;
  };

  const createPaneState = (): PaneState => ({
    tabs: [],
    activeTabId: null,
    note: null,
    titleValue: "",
    editorContent: createEmptyDocument(),
    editorPlainText: "",
  });

  let project: Project | null = null;
  let projects: Project[] = [];
  let notes: NoteIndexEntry[] = [];
  let splitEnabled = false;
  let activePane: PaneId = "primary";
  let paneStates: Record<PaneId, PaneState> = {
    primary: createPaneState(),
    secondary: createPaneState(),
  };
  let activePaneState: PaneState = paneStates[activePane];
  let activeNote: NoteDocumentFile | null = null;
  let activeTabId: string | null = null;
  let activeTabs: string[] = [];
  let tabTitles: Record<string, string> = {};
  let draggingTabId: string | null = null;
  let draggingTabPane: PaneId | null = null;
  let dropTargetTabId: string | null = null;
  let draggingNoteId: string | null = null;
  let dropTargetNoteId: string | null = null;
  let primaryTitleInput: HTMLInputElement | null = null;
  let secondaryTitleInput: HTMLInputElement | null = null;
  let isLoading = true;
  let saveState: "idle" | "saving" | "saved" = "idle";
  let mobileView: MobileView = "notes";
  let workspaceMode: "notes" | "graph" = "notes";
  let activeFolderId: string | null = null;
  let searchState: SearchIndexState | null = null;
  let wikiLinkCandidates: WikiLinkCandidate[] = [];
  let rightPanelTab: RightPanelTab = "outline";
  let linkedMentions: BacklinkEntry[] = [];
  let backlinksLoading = false;
  let notesRevision = 0;
  let backlinksKey = "";

  const saveDelay = 400;
  const uiStateDelay = 800;
  const backlinksDelay = 200;

  type NoteSaveTask = ReturnType<typeof createDebouncedTask<[NoteDocumentFile]>>;
  const saveTasks: Record<string, NoteSaveTask> = {};
  const pendingSaveIds: Record<string, true> = {};
  let pendingSaveCount = 0;

  let projectId = "";
  $: projectId = $page.params.projectId ?? "";
  $: activePaneState = paneStates[activePane];
  $: activeNote = activePaneState.note;
  $: activeTabId = activePaneState.activeTabId;
  $: activeTabs = activePaneState.tabs;
  $: wikiLinkCandidates = notes
    .filter((note) => note.deletedAt === null)
    .map((note) => ({ id: note.id, title: note.title }));

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

  const getPaneState = (paneId: PaneId): PaneState => paneStates[paneId];

  const updatePaneState = (
    paneId: PaneId,
    updates: Partial<PaneState>
  ): void => {
    paneStates = {
      ...paneStates,
      [paneId]: {
        ...paneStates[paneId],
        ...updates,
      },
    };
  };

  const markPendingSave = (noteId: string): void => {
    if (pendingSaveIds[noteId]) {
      return;
    }
    pendingSaveIds[noteId] = true;
    pendingSaveCount += 1;
  };

  const clearPendingSave = (noteId: string): void => {
    if (!pendingSaveIds[noteId]) {
      return;
    }
    delete pendingSaveIds[noteId];
    pendingSaveCount = Math.max(0, pendingSaveCount - 1);
  };

  const syncSaveState = (): void => {
    if (pendingSaveCount > 0) {
      saveState = "saving";
      return;
    }
    const hasActive =
      paneStates.primary.note !== null ||
      (splitEnabled && paneStates.secondary.note !== null);
    saveState = hasActive ? "saved" : "idle";
  };

  const setActivePane = (paneId: PaneId): void => {
    activePane = paneId;
    scheduleUiStateWrite();
  };

  const setPaneNote = (paneId: PaneId, note: NoteDocumentFile | null): void => {
    updatePaneState(paneId, {
      note,
      titleValue: note?.title ?? "",
      editorContent: note?.pmDoc ?? createEmptyDocument(),
      editorPlainText: note?.derived?.plainText ?? "",
    });
    syncSaveState();
  };

  const buildWorkspaceUiState = (): UIState => ({
    workspaceState: {
      projectId,
      splitEnabled,
      focusedPane: activePane,
      tabsPrimary: paneStates.primary.tabs,
      tabsSecondary: paneStates.secondary.tabs,
      activeTabPrimary: paneStates.primary.activeTabId,
      activeTabSecondary: paneStates.secondary.activeTabId,
    },
  });

  const uiStateWriter = createDebouncedTask(
    async (state: UIState) => {
      const currentState = (await adapter.readUIState()) ?? {};
      await adapter.writeUIState({
        ...currentState,
        ...state,
      });
    },
    uiStateDelay
  );

  const scheduleUiStateWrite = (): void => {
    uiStateWriter.schedule(buildWorkspaceUiState());
  };

  const flushUiStateWrite = async (): Promise<void> => {
    if (!uiStateWriter.pending()) {
      return;
    }
    await uiStateWriter.flush();
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
    if (view === "graph") {
      workspaceMode = "graph";
      return;
    }
    if (view === "notes" || view === "editor") {
      workspaceMode = "notes";
    }
  };

  const openGlobalSearch = (): void => {
    openModal("global-search");
  };

  const openCommandPalette = (): void => {
    openModal("command-palette");
  };

  const openGraphView = (): void => {
    workspaceMode = "graph";
    mobileView = "graph";
  };

  const openNotesView = (): void => {
    workspaceMode = "notes";
    if (mobileView === "graph") {
      mobileView = "notes";
    }
  };

  const handleRightPanelTabSelect = (tab: RightPanelTab): void => {
    rightPanelTab = tab;
  };

  const resolveBacklinkTargets = (
    targetId: string,
    targetTitle: string | null
  ): string[] => {
    const targets: string[] = [];
    if (targetTitle) {
      const trimmedTitle = targetTitle.trim();
      if (trimmedTitle) {
        targets.push(trimmedTitle);
      }
    }
    if (targetId) {
      targets.push(targetId);
    }
    return targets;
  };

  let backlinkRequestId = 0;
  const backlinksRefreshTask = createDebouncedTask(
    async (targetId: string, targetTitle: string | null) => {
      const requestId = (backlinkRequestId += 1);
      if (!projectId || !targetId) {
        linkedMentions = [];
        backlinksLoading = false;
        return;
      }
      backlinksLoading = true;
      const candidates = resolveLinkedMentions(notes, targetId, targetTitle);
      if (candidates.length === 0) {
        if (requestId === backlinkRequestId) {
          linkedMentions = [];
          backlinksLoading = false;
        }
        return;
      }
      const targets = resolveBacklinkTargets(targetId, targetTitle);
      const results = await Promise.all(
        candidates.map(async (note) => {
          const document = await adapter.readNote(projectId, note.id);
          if (!document) {
            return null;
          }
          const snippet = buildBacklinkSnippet(
            document.derived?.plainText ?? "",
            targets
          );
          return {
            id: note.id,
            title: note.title,
            snippet,
          };
        })
      );
      if (requestId !== backlinkRequestId) {
        return;
      }
      linkedMentions = results.filter(
        (entry): entry is BacklinkEntry => entry !== null
      );
      backlinksLoading = false;
    },
    backlinksDelay
  );

  const sortNotes = (list: NoteIndexEntry[]): NoteIndexEntry[] =>
    [...list].sort((first, second) => second.updatedAt - first.updatedAt);

  $: activeFolderName =
    activeFolderId && project
      ? project.folders[activeFolderId]?.name ?? null
      : null;
  $: displayNotes = project
    ? orderNotesForFolder(notes, activeFolderId, project.folders)
    : [];
  $: noteListTitle = project
    ? `${project.name} / ${activeFolderName ?? "All notes"}`
    : "Notes";
  $: noteListCount = displayNotes.length;
  $: {
    const targetId = activeNote?.id ?? "";
    const targetTitle = activeNote?.title ?? "";
    const nextKey = `${targetId}:${targetTitle}:${notesRevision}`;
    if (nextKey !== backlinksKey) {
      backlinksKey = nextKey;
      if (!targetId) {
        linkedMentions = [];
        backlinksLoading = false;
      } else {
        backlinksRefreshTask.schedule(targetId, targetTitle);
      }
    }
  }

  const loadNotes = async (): Promise<void> => {
    if (!projectId) {
      return;
    }
    notes = sortNotes(await adapter.listNotes(projectId));
    notesRevision += 1;
    const storedProject = await adapter.readProject(projectId);
    if (storedProject) {
      project = storedProject;
    }
  };

  const loadProjects = async (): Promise<void> => {
    projects = await adapter.listProjects();
  };

  const readWorkspaceState = (state: UIState | null): Record<string, unknown> => {
    if (!state || typeof state.workspaceState !== "object" || !state.workspaceState) {
      return {};
    }
    return state.workspaceState as Record<string, unknown>;
  };

  const filterTabIds = (
    value: unknown,
    availableIds: string[]
  ): string[] => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter(
      (id): id is string =>
        typeof id === "string" && availableIds.includes(id)
    );
  };

  const resolveActiveTabId = (
    value: unknown,
    availableIds: string[],
    fallbackTabs: string[]
  ): string | null => {
    if (typeof value === "string" && availableIds.includes(value)) {
      return value;
    }
    return fallbackTabs[0] ?? null;
  };

  const restoreWorkspaceState = async (): Promise<void> => {
    const availableIds = notes.map(note => note.id);
    tabTitles = notes.reduce<Record<string, string>>((accumulator, note) => {
      accumulator[note.id] = note.title ?? "";
      return accumulator;
    }, {});
    if (availableIds.length === 0) {
      updatePaneState("primary", { tabs: [], activeTabId: null });
      updatePaneState("secondary", { tabs: [], activeTabId: null });
      setPaneNote("primary", null);
      setPaneNote("secondary", null);
      splitEnabled = false;
      activePane = "primary";
      syncSaveState();
      return;
    }

    const storedState = readWorkspaceState(await adapter.readUIState());
    const storedProjectId = storedState.projectId;
    const useStoredState =
      typeof storedProjectId === "string" && storedProjectId === projectId;

    let primaryTabs = useStoredState
      ? filterTabIds(storedState.tabsPrimary, availableIds)
      : [];
    const primaryActive = resolveActiveTabId(
      useStoredState ? storedState.activeTabPrimary : null,
      availableIds,
      primaryTabs
    );
    const resolvedPrimaryActive = primaryActive ?? availableIds[0] ?? null;
    if (resolvedPrimaryActive && !primaryTabs.includes(resolvedPrimaryActive)) {
      primaryTabs = addTab(primaryTabs, resolvedPrimaryActive);
    }

    let secondaryTabs = useStoredState
      ? filterTabIds(storedState.tabsSecondary, availableIds)
      : [];
    const preferredSecondary =
      useStoredState && typeof storedState.activeTabSecondary === "string"
        ? storedState.activeTabSecondary
        : null;
    const resolvedSecondaryActive = resolveSecondaryNoteId({
      availableIds,
      primaryId: resolvedPrimaryActive,
      preferredId: preferredSecondary,
      fallbackIds: [...secondaryTabs, ...primaryTabs],
    });
    if (
      resolvedSecondaryActive &&
      !secondaryTabs.includes(resolvedSecondaryActive)
    ) {
      secondaryTabs = addTab(secondaryTabs, resolvedSecondaryActive);
    }

    const storedSplitEnabled =
      useStoredState && storedState.splitEnabled === true;
    const shouldSplit = storedSplitEnabled && Boolean(resolvedSecondaryActive);
    const storedFocusedPane =
      useStoredState && storedState.focusedPane === "secondary"
        ? "secondary"
        : "primary";

    updatePaneState("primary", {
      tabs: primaryTabs,
      activeTabId: resolvedPrimaryActive,
    });
    updatePaneState("secondary", {
      tabs: secondaryTabs,
      activeTabId: resolvedSecondaryActive,
    });

    if (resolvedPrimaryActive) {
      await loadNote(resolvedPrimaryActive, "primary");
    } else {
      setPaneNote("primary", null);
    }
    if (shouldSplit && resolvedSecondaryActive) {
      await loadNote(resolvedSecondaryActive, "secondary");
    } else {
      setPaneNote("secondary", null);
    }

    splitEnabled = shouldSplit;
    activePane = shouldSplit ? storedFocusedPane : "primary";
    syncSaveState();
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

  const loadNote = async (
    noteId: string,
    paneId: PaneId
  ): Promise<void> => {
    const note = await adapter.readNote(projectId, noteId);
    if (note) {
      setPaneNote(paneId, note);
      tabTitles = { ...tabTitles, [note.id]: note.title ?? "" };
    }
  };

  const activateTab = async (
    noteId: string,
    paneId: PaneId = activePane
  ): Promise<void> => {
    if (!noteId) {
      return;
    }
    openNotesView();
    const pane = getPaneState(paneId);
    await flushPendingSaveForNote(pane.activeTabId);
    const nextTabs = addTab(pane.tabs, noteId);
    updatePaneState(paneId, {
      tabs: nextTabs,
      activeTabId: noteId,
    });
    scheduleUiStateWrite();
    await loadNote(noteId, paneId);
  };

  const handleCloseTab = async (
    noteId: string,
    paneId: PaneId = activePane
  ): Promise<void> => {
    const pane = getPaneState(paneId);
    const wasActive = noteId === pane.activeTabId;
    if (wasActive) {
      await flushPendingSaveForNote(pane.activeTabId);
    }
    const nextState = closeTabState(
      { tabs: pane.tabs, activeTabId: pane.activeTabId },
      noteId
    );
    updatePaneState(paneId, {
      tabs: nextState.tabs,
      activeTabId: nextState.activeTabId,
    });
    if (noteId in tabTitles) {
      const { [noteId]: _closedTitle, ...rest } = tabTitles;
      tabTitles = rest;
    }
    scheduleUiStateWrite();
    if (!wasActive) {
      return;
    }
    if (nextState.activeTabId) {
      await loadNote(nextState.activeTabId, paneId);
      return;
    }
    setPaneNote(paneId, null);
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

  const handlePaneKeydown = (
    event: KeyboardEvent,
    paneId: PaneId
  ): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActivePane(paneId);
    }
  };

  const handleTabDragStart = (
    event: DragEvent,
    noteId: string
  ): void => {
    draggingTabId = noteId;
    draggingTabPane = activePane;
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
    const pane = getPaneState(activePane);
    updatePaneState(activePane, {
      tabs: reorderTabs(pane.tabs, draggedId, noteId),
    });
    scheduleUiStateWrite();
    dropTargetTabId = null;
  };

  const handleTabDragEnd = (): void => {
    draggingTabId = null;
    draggingTabPane = null;
    dropTargetTabId = null;
  };

  const resolveNoteDocument = async (
    noteId: string
  ): Promise<NoteDocumentFile | null> => {
    if (paneStates.primary.note?.id === noteId) {
      return paneStates.primary.note;
    }
    if (paneStates.secondary.note?.id === noteId) {
      return paneStates.secondary.note;
    }
    return adapter.readNote(projectId, noteId);
  };

  const syncPaneNoteFolder = (
    noteId: string,
    note: NoteDocumentFile
  ): void => {
    if (paneStates.primary.note?.id === noteId) {
      updatePaneState("primary", {
        note,
        titleValue: note.title ?? "",
        editorContent: note.pmDoc ?? createEmptyDocument(),
        editorPlainText: note.derived?.plainText ?? "",
      });
    }
    if (paneStates.secondary.note?.id === noteId) {
      updatePaneState("secondary", {
        note,
        titleValue: note.title ?? "",
        editorContent: note.pmDoc ?? createEmptyDocument(),
        editorPlainText: note.derived?.plainText ?? "",
      });
    }
  };

  const reorderNotesInActiveFolder = async (
    fromId: string,
    toId: string
  ): Promise<void> => {
    if (!project || !activeFolderId) {
      return;
    }
    const currentOrder = resolveFolderNoteOrder(
      notes,
      activeFolderId,
      project.folders
    );
    const nextOrder = reorderNoteIds(currentOrder, fromId, toId);
    if (nextOrder === currentOrder) {
      return;
    }
    const nextFolders = setFolderNoteOrder(
      project.folders,
      activeFolderId,
      nextOrder
    );
    const updatedProject: Project = {
      ...project,
      folders: nextFolders,
      updatedAt: Date.now(),
    };
    await persistProject(updatedProject);
  };

  const moveNoteToFolder = async (
    noteId: string,
    targetFolderId: string
  ): Promise<void> => {
    if (!project) {
      return;
    }
    await flushPendingSaveForNote(noteId);
    const noteDocument = await resolveNoteDocument(noteId);
    if (!noteDocument) {
      return;
    }
    const sourceFolderId = noteDocument.folderId ?? null;
    if (sourceFolderId === targetFolderId) {
      return;
    }
    const sourceOrder =
      sourceFolderId && project
        ? resolveFolderNoteOrder(notes, sourceFolderId, project.folders)
        : [];
    const targetOrder = resolveFolderNoteOrder(
      notes,
      targetFolderId,
      project.folders
    );
    const nextSourceOrder = sourceFolderId
      ? sourceOrder.filter((id) => id !== noteId)
      : [];
    const nextTargetOrder = [...targetOrder.filter((id) => id !== noteId), noteId];
    const updatedNote: NoteDocumentFile = {
      ...noteDocument,
      folderId: targetFolderId,
      updatedAt: Date.now(),
    };
    syncPaneNoteFolder(noteId, updatedNote);
    await persistNote(updatedNote);

    const storedProject = await adapter.readProject(projectId);
    if (!storedProject) {
      return;
    }
    let nextFolders = storedProject.folders;
    if (sourceFolderId) {
      nextFolders = setFolderNoteOrder(
        nextFolders,
        sourceFolderId,
        nextSourceOrder
      );
    }
    nextFolders = setFolderNoteOrder(
      nextFolders,
      targetFolderId,
      nextTargetOrder
    );
    const updatedProject: Project = {
      ...storedProject,
      folders: nextFolders,
      updatedAt: Date.now(),
    };
    await persistProject(updatedProject);
    await loadNotes();
  };

  const handleFolderNoteDrop = async (
    noteId: string,
    folderId: string
  ): Promise<void> => {
    await moveNoteToFolder(noteId, folderId);
    handleNoteDragEnd();
  };

  const handleNoteDragStart = (noteId: string, event: DragEvent): void => {
    draggingNoteId = noteId;
    dropTargetNoteId = null;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", noteId);
    }
  };

  const handleNoteDragOver = (noteId: string, event: DragEvent): void => {
    if (!activeFolderId) {
      return;
    }
    if (!draggingNoteId || draggingNoteId === noteId) {
      return;
    }
    event.preventDefault();
    dropTargetNoteId = noteId;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  };

  const handleNoteDrop = async (
    noteId: string,
    event: DragEvent
  ): Promise<void> => {
    if (!activeFolderId) {
      return;
    }
    event.preventDefault();
    const draggedId =
      draggingNoteId || event.dataTransfer?.getData("text/plain") || "";
    if (!draggedId || draggedId === noteId) {
      dropTargetNoteId = null;
      return;
    }
    await reorderNotesInActiveFolder(draggedId, noteId);
    dropTargetNoteId = null;
  };

  const handleNoteDragEnd = (): void => {
    draggingNoteId = null;
    dropTargetNoteId = null;
  };

  const moveTabToPane = async (
    noteId: string,
    sourcePane: PaneId,
    targetPane: PaneId
  ): Promise<void> => {
    if (sourcePane === targetPane) {
      return;
    }
    const source = getPaneState(sourcePane);
    if (!source.tabs.includes(noteId)) {
      return;
    }
    const target = getPaneState(targetPane);
    if (source.activeTabId === noteId) {
      await flushPendingSaveForNote(source.activeTabId);
    }
    if (target.activeTabId && target.activeTabId !== noteId) {
      await flushPendingSaveForNote(target.activeTabId);
    }
    const nextStates = moveTabBetweenPanes(
      { tabs: source.tabs, activeTabId: source.activeTabId },
      { tabs: target.tabs, activeTabId: target.activeTabId },
      noteId
    );
    updatePaneState(sourcePane, nextStates.source);
    updatePaneState(targetPane, nextStates.target);
    activePane = targetPane;
    scheduleUiStateWrite();
    if (source.activeTabId === noteId) {
      if (nextStates.source.activeTabId) {
        await loadNote(nextStates.source.activeTabId, sourcePane);
      } else {
        setPaneNote(sourcePane, null);
      }
    }
    await loadNote(noteId, targetPane);
  };

  const handlePaneDragOver = (event: DragEvent, paneId: PaneId): void => {
    if (!splitEnabled) {
      return;
    }
    const draggedId =
      draggingTabId || event.dataTransfer?.getData("text/plain") || "";
    if (!draggedId || draggingTabPane === paneId) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  };

  const handlePaneDrop = async (
    event: DragEvent,
    paneId: PaneId
  ): Promise<void> => {
    if (!splitEnabled) {
      return;
    }
    event.preventDefault();
    const draggedId =
      draggingTabId || event.dataTransfer?.getData("text/plain") || "";
    const sourcePane = draggingTabPane;
    if (!draggedId || !sourcePane || sourcePane === paneId) {
      handleTabDragEnd();
      return;
    }
    await moveTabToPane(draggedId, sourcePane, paneId);
    handleTabDragEnd();
  };

  const persistNote = async (note: NoteDocumentFile): Promise<void> => {
    const activeNotes = notes.filter((entry) => entry.deletedAt === null);
    const resolvedPlainText = note.derived?.plainText ?? "";
    const outgoingLinks = resolveOutgoingLinks(resolvedPlainText, activeNotes);
    const resolvedNote: NoteDocumentFile = {
      ...note,
      derived: {
        ...(note.derived ?? {}),
        plainText: resolvedPlainText,
        outgoingLinks,
      },
    };
    await adapter.writeNote({
      projectId,
      noteId: note.id,
      noteDocument: resolvedNote,
      derivedMarkdown: toDerivedMarkdown(
        note.title,
        resolvedPlainText
      ),
    });
    await updateSearchIndexForNote(resolvedNote);
  };

  const getSaveTask = (noteId: string): NoteSaveTask => {
    const existing = saveTasks[noteId];
    if (existing) {
      return existing;
    }
    const task = createDebouncedTask(
      async (noteSnapshot: NoteDocumentFile) => {
        await persistNote(noteSnapshot);
        await loadNotes();
        clearPendingSave(noteSnapshot.id);
        syncSaveState();
      },
      saveDelay
    );
    saveTasks[noteId] = task;
    return task;
  };

  const scheduleSave = (note: NoteDocumentFile): void => {
    markPendingSave(note.id);
    syncSaveState();
    const noteSnapshot = structuredClone(note);
    getSaveTask(note.id).schedule(noteSnapshot);
  };

  const flushPendingSaveForNote = async (
    noteId: string | null
  ): Promise<void> => {
    if (!noteId) {
      return;
    }
    const task = saveTasks[noteId];
    if (!task || !task.pending()) {
      return;
    }
    await task.flush();
  };

  const flushPendingSave = async (): Promise<void> => {
    const pendingTasks = Object.values(saveTasks).filter(task => task.pending());
    if (pendingTasks.length === 0) {
      return;
    }
    await Promise.all(pendingTasks.map(task => task.flush()));
  };

  const applyEdits = (
    paneId: PaneId,
    updates: {
      title?: string;
      pmDoc?: Record<string, unknown>;
      plainText?: string;
    }
  ): void => {
    const pane = getPaneState(paneId);
    if (!pane.note) {
      return;
    }
    const timestamp = Date.now();
    const nextTitleValue = updates.title ?? pane.titleValue;
    const resolvedTitle = nextTitleValue.trim();
    const resolvedDoc = updates.pmDoc ?? pane.note.pmDoc ?? createEmptyDocument();
    const resolvedPlainText = updates.plainText ?? pane.editorPlainText;
    const updatedNote: NoteDocumentFile = {
      ...pane.note,
      title: resolvedTitle,
      updatedAt: timestamp,
      pmDoc: resolvedDoc,
      derived: {
        plainText: resolvedPlainText,
        outgoingLinks: pane.note.derived?.outgoingLinks ?? [],
      },
    };
    updatePaneState(paneId, {
      note: updatedNote,
      titleValue: nextTitleValue,
      editorPlainText: resolvedPlainText,
    });
    tabTitles = { ...tabTitles, [updatedNote.id]: resolvedTitle };
    scheduleSave(updatedNote);
  };

  const handleTitleInput = (paneId: PaneId, event: Event): void => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    applyEdits(paneId, { title: target.value });
  };

  const handleTitleBlur = (paneId: PaneId, event: Event): void => {
    handleTitleInput(paneId, event);
    const pane = getPaneState(paneId);
    if (pane.note) {
      void flushPendingSaveForNote(pane.note.id);
    }
  };

  const handleEditorUpdate = (
    paneId: PaneId,
    payload: {
      json: Record<string, unknown>;
      text: string;
    }
  ): void => {
    const titleInput =
      paneId === "primary" ? primaryTitleInput : secondaryTitleInput;
    const titleValue = titleInput?.value;
    applyEdits(paneId, {
      pmDoc: payload.json,
      plainText: payload.text,
      title: titleValue,
    });
  };

  const createNote = async (): Promise<void> => {
    await flushPendingSave();
    openNotesView();
    const note = createNoteDocument();
    setPaneNote(activePane, note);
    const pane = getPaneState(activePane);
    updatePaneState(activePane, {
      tabs: addTab(pane.tabs, note.id),
      activeTabId: note.id,
    });
    tabTitles = { ...tabTitles, [note.id]: note.title ?? "" };
    saveState = "saving";
    scheduleUiStateWrite();
    await persistNote(note);
    await loadNotes();
    if (activeFolderId && project?.folders[activeFolderId]?.noteIds) {
      const currentOrder = resolveFolderNoteOrder(
        notes,
        activeFolderId,
        project.folders
      );
      const nextOrder = [...currentOrder.filter((id) => id !== note.id), note.id];
      const nextFolders = setFolderNoteOrder(
        project.folders,
        activeFolderId,
        nextOrder
      );
      const updatedProject: Project = {
        ...project,
        folders: nextFolders,
        updatedAt: Date.now(),
      };
      await persistProject(updatedProject);
    }
    syncSaveState();
  };

  const toggleSplitView = async (): Promise<void> => {
    if (!splitEnabled) {
      const availableIds = notes.map(note => note.id);
      let primaryId = paneStates.primary.activeTabId;
      if (!primaryId) {
        primaryId = availableIds[0] ?? null;
        if (primaryId) {
          await activateTab(primaryId, "primary");
        }
      }
      const secondaryId = resolveSecondaryNoteId({
        availableIds,
        primaryId,
        preferredId: paneStates.secondary.activeTabId,
        fallbackIds: [
          ...paneStates.secondary.tabs,
          ...paneStates.primary.tabs,
        ],
      });
      if (secondaryId) {
        const secondaryTabs = addTab(paneStates.secondary.tabs, secondaryId);
        updatePaneState("secondary", {
          tabs: secondaryTabs,
          activeTabId: secondaryId,
        });
        await loadNote(secondaryId, "secondary");
      } else {
        updatePaneState("secondary", { tabs: [], activeTabId: null });
        setPaneNote("secondary", null);
      }
      splitEnabled = true;
      activePane = "primary";
      scheduleUiStateWrite();
      syncSaveState();
      return;
    }
    splitEnabled = false;
    activePane = "primary";
    scheduleUiStateWrite();
    syncSaveState();
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
    await flushUiStateWrite();
    const currentState = (await adapter.readUIState()) ?? {};
    await adapter.writeUIState({
      ...currentState,
      ...buildWorkspaceUiState(),
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
      await restoreWorkspaceState();
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
        return;
      }
      if (key === "g" && !event.shiftKey) {
        event.preventDefault();
        openGraphView();
        return;
      }
      if (event.shiftKey && (event.key === "\\" || event.key === "|")) {
        event.preventDefault();
        void toggleSplitView();
      }
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") {
        void flushPendingSave();
        void flushUiStateWrite();
      }
    };

    const handleBeforeUnload = (): void => {
      void flushPendingSave();
      void flushUiStateWrite();
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
      {#each activeTabs as tabId (tabId)}
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
      <button
        class="icon-button"
        type="button"
        aria-label="Toggle split view"
        aria-pressed={splitEnabled}
        data-testid="toggle-split"
        on:click={() => void toggleSplitView()}
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
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M12 4v16" />
        </svg>
      </button>
      <RightPanelTabs
        activeTab={rightPanelTab}
        onSelect={handleRightPanelTabSelect}
      />
    </div>
  </div>

  <div slot="sidebar" class="sidebar-content">
    <ProjectSwitcher
      {projects}
      activeProjectId={project?.id ?? projectId}
      onSelect={switchProject}
    />
    <div class="sidebar-views" role="list" aria-label="Views">
      <button
        class="sidebar-view"
        type="button"
        aria-pressed={workspaceMode === "notes"}
        data-active={workspaceMode === "notes"}
        data-testid="sidebar-view-notes"
        on:click={openNotesView}
      >
        Notes
      </button>
      <button
        class="sidebar-view"
        type="button"
        aria-pressed={workspaceMode === "graph"}
        data-active={workspaceMode === "graph"}
        data-testid="sidebar-view-graph"
        on:click={openGraphView}
      >
        Graph
      </button>
    </div>
    <FolderTree
      folders={project?.folders ?? {}}
      notesIndex={project?.notesIndex ?? {}}
      {activeFolderId}
      {draggingNoteId}
      onSelect={selectFolder}
      onCreate={createFolder}
      onRename={renameFolder}
      onDelete={deleteFolder}
      onNoteDrop={handleFolderNoteDrop}
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
        draggable={true}
        draggingNoteId={draggingNoteId}
        dropTargetNoteId={dropTargetNoteId}
        onDragStart={handleNoteDragStart}
        onDragOver={handleNoteDragOver}
        onDrop={handleNoteDrop}
        onDragEnd={handleNoteDragEnd}
      />
    {/if}
  </div>

  <div
    slot="editor"
    class={workspaceMode === "graph" ? "graph-content" : "editor-content"}
    data-split={splitEnabled ? "true" : "false"}
  >
    {#if workspaceMode === "graph"}
      <GraphView
        notes={notes}
        tags={project?.tags ?? {}}
        activeNoteId={activeNote?.id ?? null}
      />
    {:else}
      {#if splitEnabled}
        <div
          class="editor-pane"
          data-pane="primary"
          data-active={activePane === "primary"}
          data-testid="editor-pane-primary"
          on:focusin={() => setActivePane("primary")}
          on:click={() => setActivePane("primary")}
          on:keydown={event => handlePaneKeydown(event, "primary")}
          on:dragover={event => handlePaneDragOver(event, "primary")}
          on:drop={event => void handlePaneDrop(event, "primary")}
          role="button"
          tabindex="0"
        >
          {#if isLoading}
            <div class="editor-empty">Preparing editor...</div>
          {:else if !paneStates.primary.note}
            <div class="editor-empty">Select a note to start writing.</div>
          {:else}
            <div class="editor-header">
              <input
                class="title-input field-input"
                data-testid="note-title"
                type="text"
                placeholder="Untitled"
                bind:this={primaryTitleInput}
                value={paneStates.primary.titleValue}
                on:input={event => handleTitleInput("primary", event)}
                on:blur={event => handleTitleBlur("primary", event)}
                aria-label="Note title"
              />
              <div class="chips-row" aria-label="Metadata chips"></div>
            </div>

            <div class="field field-body">
              <span class="field-label">Content</span>
              <TiptapEditor
                content={paneStates.primary.editorContent}
                ariaLabel="Note content"
                dataTestId="note-body"
                linkCandidates={wikiLinkCandidates}
                onImagePaste={handleImagePaste}
                onUpdate={payload => handleEditorUpdate("primary", payload)}
              />
            </div>
          {/if}
        </div>

        <div
          class="editor-pane"
          data-pane="secondary"
          data-active={activePane === "secondary"}
          data-testid="editor-pane-secondary"
          on:focusin={() => setActivePane("secondary")}
          on:click={() => setActivePane("secondary")}
          on:keydown={event => handlePaneKeydown(event, "secondary")}
          on:dragover={event => handlePaneDragOver(event, "secondary")}
          on:drop={event => void handlePaneDrop(event, "secondary")}
          role="button"
          tabindex="0"
        >
          {#if isLoading}
            <div class="editor-empty">Preparing editor...</div>
          {:else if !paneStates.secondary.note}
            <div class="editor-empty">Select a note to start writing.</div>
          {:else}
            <div class="editor-header">
              <input
                class="title-input field-input"
                data-testid="note-title-secondary"
                type="text"
                placeholder="Untitled"
                bind:this={secondaryTitleInput}
                value={paneStates.secondary.titleValue}
                on:input={event => handleTitleInput("secondary", event)}
                on:blur={event => handleTitleBlur("secondary", event)}
                aria-label="Note title"
              />
              <div class="chips-row" aria-label="Metadata chips"></div>
            </div>

            <div class="field field-body">
              <span class="field-label">Content</span>
              <TiptapEditor
                content={paneStates.secondary.editorContent}
                ariaLabel="Note content"
                dataTestId="note-body-secondary"
                linkCandidates={wikiLinkCandidates}
                onImagePaste={handleImagePaste}
                onUpdate={payload => handleEditorUpdate("secondary", payload)}
              />
            </div>
          {/if}
        </div>
      {:else}
        {#if isLoading}
          <div class="editor-empty">Preparing editor...</div>
        {:else if !paneStates.primary.note}
          <div class="editor-empty">Select a note to start writing.</div>
        {:else}
          <div class="editor-header">
            <input
              class="title-input field-input"
              data-testid="note-title"
              type="text"
              placeholder="Untitled"
              bind:this={primaryTitleInput}
              value={paneStates.primary.titleValue}
              on:input={event => handleTitleInput("primary", event)}
              on:blur={event => handleTitleBlur("primary", event)}
              aria-label="Note title"
            />
            <div class="chips-row" aria-label="Metadata chips"></div>
          </div>

          <div class="field field-body">
            <span class="field-label">Content</span>
            <TiptapEditor
              content={paneStates.primary.editorContent}
              ariaLabel="Note content"
              dataTestId="note-body"
              linkCandidates={wikiLinkCandidates}
              onImagePaste={handleImagePaste}
              onUpdate={payload => handleEditorUpdate("primary", payload)}
            />
          </div>
        {/if}
      {/if}
    {/if}
  </div>

  <RightPanel
    slot="right-panel"
    activeTab={rightPanelTab}
    activeNoteId={activeNote?.id ?? null}
    linkedMentions={linkedMentions}
    backlinksLoading={backlinksLoading}
    onOpenNote={activateTab}
  />

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
    onToggleSplitView={toggleSplitView}
    onToggleRightPanel={handleRightPanelTabSelect}
    onOpenGraph={openGraphView}
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
      class:active={mobileView === "graph"}
      type="button"
      data-testid="mobile-nav-graph"
      aria-pressed={mobileView === "graph"}
      on:click={() => setMobileView("graph")}
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

  .icon-button[aria-pressed="true"] {
    background: var(--bg-2);
    border-color: var(--stroke-0);
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

  .sidebar-views {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .sidebar-view {
    height: 32px;
    padding: 0 12px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-1);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }

  .sidebar-view:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .sidebar-view[data-active="true"] {
    background: var(--accent-2);
    color: var(--accent-0);
    border-color: var(--accent-2);
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
    min-height: 0;
  }

  .graph-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    min-height: 0;
  }

  .editor-content[data-split="true"] {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 16px;
    height: 100%;
  }

  .editor-pane {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
    min-height: 0;
    overflow: auto;
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

  @media (max-width: 1023px) {
    .editor-content[data-split="true"] {
      grid-template-columns: 1fr;
    }
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
