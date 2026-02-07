<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { get } from "svelte/store";
  import AppShell from "$lib/components/AppShell.svelte";
  import ToastHost from "$lib/components/ToastHost.svelte";
  import RightPanel from "$lib/components/rightpanel/RightPanel.svelte";
  import RightPanelTabs from "$lib/components/rightpanel/RightPanelTabs.svelte";
  import ModalHost from "$lib/components/modals/ModalHost.svelte";
  import TiptapEditor from "$lib/components/editor/TiptapEditor.svelte";
  import NoteListVirtualized from "$lib/components/notes/NoteListVirtualized.svelte";
  import TrashNoteRow from "$lib/components/notes/TrashNoteRow.svelte";
  import FolderTree from "$lib/components/sidebar/FolderTree.svelte";
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
  import { filterNotesByFavorites } from "$lib/core/utils/notes-filter";
  import { createUlid } from "$lib/core/utils/ulid";
  import { createDebouncedTask } from "$lib/core/utils/debounce";
  import { hashBlobSha256 } from "$lib/core/utils/hash";
  import { formatCustomFieldValue } from "$lib/core/utils/custom-fields";
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
  import { modalStackStore, openModal, pushToast } from "$lib/state/ui.store";
  import {
    resolveMobileView,
    type MobileView,
  } from "$lib/core/utils/mobile-view";
  import {
    adapter as adapterStore,
    initAdapter,
    storageMode as storageModeStore,
    type StorageMode,
  } from "$lib/state/adapter.store";
  import { createDefaultProject } from "$lib/core/storage/indexeddb.adapter";
  import type {
    AssetMeta,
    CustomFieldValue,
    NoteDocumentFile,
    NoteIndexEntry,
    Project,
    StorageAdapter,
    UIState,
  } from "$lib/core/storage/types";
  let adapter = get(adapterStore);
  const adapterUnsubscribe = adapterStore.subscribe((value) => {
    adapter = value;
  });
  let activeStorageMode: StorageMode = get(storageModeStore);
  const storageModeUnsubscribe = storageModeStore.subscribe((value) => {
    activeStorageMode = value;
  });
  let permissionModalId: string | null = null;
  let modalStackEntries: { id: string }[] = [];
  const modalStackUnsubscribe = modalStackStore.subscribe((stack) => {
    modalStackEntries = stack;
    if (
      permissionModalId &&
      !modalStackEntries.some((entry) => entry.id === permissionModalId)
    ) {
      permissionModalId = null;
    }
  });

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
  let notes: NoteIndexEntry[] = [];
  let filteredNotes: NoteIndexEntry[] = [];
  let splitEnabled = false;
  let activePane: PaneId = "primary";
  let favoriteOverrides: Record<string, boolean> = {};
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
  let workspaceMode: "notes" = "notes";
  let activeFolderId: string | null = null;
  let favoritesOnly = false;
  let trashOnly = false;
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
  const permissionErrorNames = new Set(["NotAllowedError", "SecurityError"]);
  let isRecoveringStorage = false;

  type NoteSaveTask = ReturnType<typeof createDebouncedTask<[NoteDocumentFile]>>;
  const saveTasks: Record<string, NoteSaveTask> = {};
  const pendingSaveIds: Record<string, true> = {};
  let pendingSaveCount = 0;

  let projectId = "";
  $: activePaneState = paneStates[activePane];
  $: activeNote = activePaneState.note;
  $: activeTabId = activePaneState.activeTabId;
  $: activeTabs = activePaneState.tabs;
  $: hasActiveEditor = Boolean(activeNote);
  $: wikiLinkCandidates = notes
    .filter((note) => note.deletedAt === null)
    .map((note) => ({ id: note.id, title: note.title }));

  const isPermissionError = (error: unknown): boolean =>
    error instanceof Error && permissionErrorNames.has(error.name);

  const isAbortError = (error: unknown): boolean =>
    error instanceof Error && error.name === "AbortError";

  const adapterErrorToastMessage = "Storage error. Please retry.";
  const adapterFallbackToastMessage =
    "Could not access folder, switched to browser storage.";
  const adapterToastCooldownMs = 2500;
  let lastAdapterToastAt = 0;

  const notifyAdapterFailure = (
    message: string = adapterErrorToastMessage
  ): void => {
    const now = Date.now();
    if (now - lastAdapterToastAt < adapterToastCooldownMs) {
      return;
    }
    lastAdapterToastAt = now;
    pushToast(message, { tone: "error" });
  };

  const handleNonBlockingAdapterError = (error: unknown): void => {
    if (isAbortError(error)) {
      return;
    }
    notifyAdapterFailure();
  };

  const openPermissionRecovery = (): void => {
    if (permissionModalId) {
      return;
    }
    permissionModalId = openModal("confirm", {
      title: "Folder access lost",
      message:
        "EmberVault can't access the vault folder. Retry access or switch to browser storage.",
      confirmLabel: "Retry access",
      cancelLabel: "Switch to browser storage",
      onConfirm: async () => {
        permissionModalId = null;
        await retryFolderAccess();
      },
      onCancel: async () => {
        permissionModalId = null;
        await switchToBrowserStorage();
      },
    });
  };

  const handleAdapterError = async (error: unknown): Promise<boolean> => {
    if (activeStorageMode !== "filesystem") {
      return false;
    }
    if (!isPermissionError(error)) {
      return false;
    }
    openPermissionRecovery();
    return true;
  };

  const runAdapterTask = async function runAdapterTask<T>(
    operation: () => Promise<T>,
    fallback: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const handled = await handleAdapterError(error);
      if (handled) {
        return fallback;
      }
      handleNonBlockingAdapterError(error);
      return fallback;
    }
  };

  const runAdapterVoid = async (
    operation: () => Promise<void>
  ): Promise<boolean> => {
    try {
      await operation();
      return true;
    } catch (error) {
      const handled = await handleAdapterError(error);
      if (handled) {
        return false;
      }
      handleNonBlockingAdapterError(error);
      return false;
    }
  };

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

  const ensureProjectForAdapter = async (
    activeAdapter: StorageAdapter
  ): Promise<Project> => {
    const projects = await runAdapterTask(
      () => activeAdapter.listProjects(),
      []
    );
    if (projects.length > 0) {
      return projects[0] ?? createDefaultProject();
    }
    const project = createDefaultProject();
    await runAdapterVoid(() => activeAdapter.createProject(project));
    return project;
  };

  const retryFolderAccess = async (): Promise<void> => {
    if (
      isRecoveringStorage ||
      typeof window === "undefined" ||
      typeof window.showDirectoryPicker !== "function"
    ) {
      return;
    }
    isRecoveringStorage = true;
    isLoading = true;
    try {
      const handle = await window.showDirectoryPicker();
      const nextAdapter = initAdapter("filesystem", {
        directoryHandle: handle,
      });
      const ready = await runAdapterVoid(() => nextAdapter.init());
      if (!ready) {
        return;
      }
      const project = await ensureProjectForAdapter(nextAdapter);
      await runAdapterVoid(() =>
        nextAdapter.writeUIState({ lastProjectId: project.id })
      );
      projectId = project.id;
      await initializeWorkspace();
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      const handled = await handleAdapterError(error);
      if (!handled) {
        handleNonBlockingAdapterError(error);
      }
    } finally {
      isRecoveringStorage = false;
      isLoading = false;
    }
  };

  const switchToBrowserStorage = async (): Promise<void> => {
    if (isRecoveringStorage) {
      return;
    }
    isRecoveringStorage = true;
    isLoading = true;
    try {
      const nextAdapter = initAdapter("idb");
      const ready = await runAdapterVoid(() => nextAdapter.init());
      if (!ready) {
        return;
      }
      const project = await ensureProjectForAdapter(nextAdapter);
      await runAdapterVoid(() =>
        nextAdapter.writeUIState({ lastProjectId: project.id })
      );
      projectId = project.id;
      await initializeWorkspace();
      notifyAdapterFailure(adapterFallbackToastMessage);
    } finally {
      isRecoveringStorage = false;
      isLoading = false;
    }
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
    await runAdapterVoid(() =>
      adapter.writeAsset({
        projectId,
        assetId,
        blob: file,
        meta,
      })
    );
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
    const hasActiveNotes =
      paneStates.primary.note !== null ||
      (splitEnabled && paneStates.secondary.note !== null);
    saveState = hasActiveNotes ? "saved" : "idle";
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
      const currentState =
        (await runAdapterTask(() => adapter.readUIState(), null)) ?? {};
      await runAdapterVoid(() =>
        adapter.writeUIState({
          ...currentState,
          ...state,
        })
      );
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
  };

  const openGlobalSearch = (): void => {
    openModal("global-search");
  };

  const openCommandPalette = (): void => {
    openModal("command-palette");
  };

  const openNotesView = (): void => {
    workspaceMode = "notes";
  };

  const toggleFavoritesFilter = (): void => {
    const next = !favoritesOnly;
    favoritesOnly = next;
    if (next) {
      trashOnly = false;
    }
  };

  const toggleTrashFilter = (): void => {
    const next = !trashOnly;
    trashOnly = next;
    if (next) {
      favoritesOnly = false;
      activeFolderId = null;
    }
  };

  const openTrashView = (): void => {
    openNotesView();
    mobileView = "notes";
    trashOnly = true;
    favoritesOnly = false;
    activeFolderId = null;
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
          const document = await runAdapterTask(
            () => adapter.readNote(projectId, note.id),
            null
          );
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

  const sortTrashNotes = (list: NoteIndexEntry[]): NoteIndexEntry[] =>
    [...list].sort(
      (first, second) => (second.deletedAt ?? 0) - (first.deletedAt ?? 0)
    );

  $: activeFolderName =
    activeFolderId && project
      ? project.folders[activeFolderId]?.name ?? null
      : null;
  $: displayNotes = project
    ? orderNotesForFolder(notes, activeFolderId, project.folders)
    : [];
  $: trashedNotes = sortTrashNotes(
    notes.filter((note) => note.deletedAt !== null)
  );
  $: filteredNotes = trashOnly
    ? trashedNotes
    : filterNotesByFavorites(displayNotes, favoritesOnly);
  $: noteListTitle = project
    ? trashOnly
      ? `${project.name} / Trash`
      : `${project.name} / ${activeFolderName ?? "All notes"}`
    : "Notes";
  $: noteListCount = filteredNotes.length;
  $: noteListEmptyMessage = trashOnly
    ? "Trash is empty."
    : favoritesOnly
      ? "No favorites yet."
      : "No notes yet.";
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
    const loadedNotes = sortNotes(
      await runAdapterTask(() => adapter.listNotes(projectId), [])
    );
    if (Object.keys(favoriteOverrides).length > 0) {
      notes = loadedNotes.map((note) => {
        const override = favoriteOverrides[note.id];
        return override === undefined ? note : { ...note, favorite: override };
      });
    } else {
      notes = loadedNotes;
    }
    notesRevision += 1;
    const storedProject = await runAdapterTask(
      () => adapter.readProject(projectId),
      null
    );
    if (storedProject) {
      project = storedProject;
    }
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

    const storedState = readWorkspaceState(
      await runAdapterTask(() => adapter.readUIState(), null)
    );
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
      notes.map(async (entry) =>
        runAdapterTask(() => adapter.readNote(projectId, entry.id), null)
      )
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
    searchState = await runAdapterTask(
      () => hydrateSearchIndex(adapter, projectId, [...noteDocuments]),
      null
    );
  };

  const updateSearchIndexForDocument = async (
    document: NoteDocumentFile
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
    const currentSearchState = searchState;
    searchState = await runAdapterTask(
      () =>
        applySearchIndexChange({
          adapter,
          projectId,
          state: currentSearchState,
          change: {
            type: "upsert",
            note: document,
          },
        }),
      currentSearchState
    );
  };

  const persistProject = async (nextProject: Project): Promise<void> => {
    project = nextProject;
    await runAdapterVoid(() =>
      adapter.writeProject(nextProject.id, nextProject)
    );
  };

  const loadNote = async (
    noteId: string,
    paneId: PaneId
  ): Promise<void> => {
    const note = await runAdapterTask(
      () => adapter.readNote(projectId, noteId),
      null
    );
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
    return runAdapterTask(() => adapter.readNote(projectId, noteId), null);
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

    const storedProject = await runAdapterTask(
      () => adapter.readProject(projectId),
      null
    );
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
    await runAdapterVoid(() =>
      adapter.writeNote({
        projectId,
        noteId: note.id,
        noteDocument: resolvedNote,
        derivedMarkdown: toDerivedMarkdown(note.title, resolvedPlainText),
      })
    );
    await updateSearchIndexForDocument(resolvedNote);
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
    const pendingTasks = Object.values(saveTasks).filter((task) =>
      task.pending()
    );
    if (pendingTasks.length === 0) {
      return;
    }
    await Promise.all(pendingTasks.map((task) => task.flush()));
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

  const removeNoteFromTabs = async (noteId: string): Promise<void> => {
    const panes: PaneId[] = ["primary", "secondary"];
    for (const paneId of panes) {
      const pane = getPaneState(paneId);
      if (!pane.tabs.includes(noteId)) {
        continue;
      }
      const wasActive = pane.activeTabId === noteId;
      const nextState = closeTabState(
        { tabs: pane.tabs, activeTabId: pane.activeTabId },
        noteId
      );
      updatePaneState(paneId, nextState);
      if (wasActive) {
        await flushPendingSaveForNote(noteId);
        if (nextState.activeTabId) {
          await loadNote(nextState.activeTabId, paneId);
        } else {
          setPaneNote(paneId, null);
        }
      }
    }
    const { [noteId]: _removed, ...rest } = tabTitles;
    tabTitles = rest;
    const { [noteId]: _favorite, ...nextFavorites } = favoriteOverrides;
    favoriteOverrides = nextFavorites;
  };

  const removeNoteFromLocalState = (noteId: string): void => {
    notes = notes.filter((note) => note.id !== noteId);
    notesRevision += 1;
    if (!project || !Object.hasOwn(project.notesIndex, noteId)) {
      return;
    }
    const { [noteId]: _removed, ...remainingNotes } = project.notesIndex;
    const updatedProject: Project = {
      ...project,
      notesIndex: remainingNotes,
      updatedAt: Math.max(project.updatedAt, Date.now()),
    };
    project = updatedProject;
  };

  const deleteNoteToTrash = async (noteId: string): Promise<void> => {
    if (!projectId) {
      return;
    }
    await flushPendingSaveForNote(noteId);
    await removeNoteFromTabs(noteId);
    await runAdapterVoid(() => adapter.deleteNoteSoft(projectId, noteId));
    const updatedNote = await runAdapterTask(
      () => adapter.readNote(projectId, noteId),
      null
    );
    if (updatedNote) {
      await updateSearchIndexForDocument(updatedNote);
    }
    await loadNotes();
  };

  const restoreTrashedNote = async (noteId: string): Promise<void> => {
    if (!projectId) {
      return;
    }
    await runAdapterVoid(() => adapter.restoreNote(projectId, noteId));
    const restoredNote = await runAdapterTask(
      () => adapter.readNote(projectId, noteId),
      null
    );
    if (restoredNote) {
      await updateSearchIndexForDocument(restoredNote);
    }
    await loadNotes();
  };

  const deleteNotePermanently = async (noteId: string): Promise<void> => {
    if (!projectId) {
      return;
    }
    removeNoteFromLocalState(noteId);
    await flushPendingSaveForNote(noteId);
    await removeNoteFromTabs(noteId);
    await runAdapterVoid(() =>
      adapter.deleteNotePermanent(projectId, noteId)
    );
    if (!searchState) {
      await loadSearchIndex();
    }
    const currentSearchState = searchState;
    if (currentSearchState) {
      searchState = await runAdapterTask(
        () =>
          applySearchIndexChange({
            adapter,
            projectId,
            state: currentSearchState,
            change: {
              type: "remove",
              noteId,
            },
          }),
        currentSearchState
      );
    }
    await loadNotes();
  };

  const openPermanentDeleteConfirm = (noteId: string): void => {
    const note = notes.find((entry) => entry.id === noteId);
    const title = note?.title?.trim() || "Untitled";
    openModal("confirm", {
      title: "Delete permanently?",
      message: `This will permanently delete "${title}". This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      destructive: true,
      onConfirm: async () => {
        await deleteNotePermanently(noteId);
      },
    });
  };

  const deleteNoteFromPane = (paneId: PaneId): void => {
    const pane = getPaneState(paneId);
    if (!pane.note || pane.note.deletedAt !== null) {
      return;
    }
    void deleteNoteToTrash(pane.note.id);
  };

  const updateCustomFieldsForNote = (
    noteId: string,
    fields: Record<string, CustomFieldValue>
  ): void => {
    const timestamp = Date.now();
    let updatedNote: NoteDocumentFile | null = null;
    (["primary", "secondary"] as PaneId[]).forEach((paneId) => {
      const pane = getPaneState(paneId);
      if (!pane.note || pane.note.id !== noteId) {
        return;
      }
      const nextNote: NoteDocumentFile = {
        ...pane.note,
        customFields: fields,
        updatedAt: timestamp,
      };
      updatedNote = nextNote;
      updatePaneState(paneId, { note: nextNote });
    });
    if (updatedNote) {
      scheduleSave(updatedNote);
    }
  };

  const getCustomFieldChips = (
    note: NoteDocumentFile | null
  ): Array<{ key: string; label: string }> => {
    if (!note) {
      return [];
    }
    return Object.entries(note.customFields)
      .slice(0, 3)
      .map(([key, value]) => {
        const trimmedKey = key.trim();
        if (!trimmedKey) {
          return null;
        }
        const formatted = formatCustomFieldValue(value);
        return {
          key: trimmedKey,
          label: `${trimmedKey}: ${formatted || "—"}`,
        };
      })
      .filter(
        (entry): entry is { key: string; label: string } => entry !== null
      );
  };

  const toNoteIndexEntry = (note: NoteDocumentFile): NoteIndexEntry => {
    const hasCustomFields = Object.keys(note.customFields).length > 0;
    return {
      id: note.id,
      title: note.title,
      folderId: note.folderId,
      tagIds: note.tagIds,
      favorite: note.favorite,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      deletedAt: note.deletedAt,
      isTemplate: note.isTemplate ?? false,
      ...(hasCustomFields ? { customFields: note.customFields } : {}),
      ...(note.derived?.outgoingLinks
        ? { linkOutgoing: note.derived.outgoingLinks }
        : {}),
    };
  };

  const updateFavoriteInNotesIndex = (noteSnapshot: NoteDocumentFile): void => {
    const exists = notes.some((note) => note.id === noteSnapshot.id);
    if (exists) {
      notes = notes.map((note) =>
        note.id === noteSnapshot.id
          ? { ...note, favorite: noteSnapshot.favorite }
          : note
      );
      return;
    }
    notes = sortNotes([...notes, toNoteIndexEntry(noteSnapshot)]);
  };

  const updateFavoriteInPanes = (
    noteId: string,
    favorite: boolean
  ): void => {
    (["primary", "secondary"] as PaneId[]).forEach((paneId) => {
      const pane = getPaneState(paneId);
      if (!pane.note || pane.note.id !== noteId) {
        return;
      }
      updatePaneState(paneId, {
        note: {
          ...pane.note,
          favorite,
        },
      });
    });
  };

  const resolveNoteSnapshot = async (
    noteId: string,
    favorite: boolean
  ): Promise<NoteDocumentFile | null> => {
    const primaryNote = paneStates.primary.note;
    if (primaryNote?.id === noteId) {
      return { ...primaryNote, favorite };
    }
    const secondaryNote = paneStates.secondary.note;
    if (secondaryNote?.id === noteId) {
      return { ...secondaryNote, favorite };
    }
    const note = await runAdapterTask(
      () => adapter.readNote(projectId, noteId),
      null
    );
    return note ? { ...note, favorite } : null;
  };

  const setNoteFavorite = async (
    noteId: string,
    favorite: boolean
  ): Promise<void> => {
    if (!projectId) {
      return;
    }
    const noteSnapshot = await resolveNoteSnapshot(noteId, favorite);
    if (!noteSnapshot) {
      return;
    }
    favoriteOverrides = {
      ...favoriteOverrides,
      [noteId]: favorite,
    };
    updateFavoriteInNotesIndex(noteSnapshot);
    updateFavoriteInPanes(noteId, favorite);
    scheduleSave(noteSnapshot);
    await flushPendingSaveForNote(noteSnapshot.id);
    const { [noteId]: _removed, ...rest } = favoriteOverrides;
    favoriteOverrides = rest;
  };

  const toggleFavoriteForPane = (paneId: PaneId): void => {
    const pane = getPaneState(paneId);
    if (!pane.note) {
      return;
    }
    void setNoteFavorite(pane.note.id, !pane.note.favorite);
  };

  const handleFavoriteToggle = (
    noteId: string,
    nextFavorite: boolean
  ): void => {
    void setNoteFavorite(noteId, nextFavorite);
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
    trashOnly = false;
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

  const resolveWorkspaceProjectId = async (): Promise<string> => {
    const projects = await runAdapterTask(() => adapter.listProjects(), []);
    if (projects.length === 0) {
      const created = createDefaultProject();
      await runAdapterVoid(() => adapter.createProject(created));
      await runAdapterVoid(() => adapter.writeUIState({ lastProjectId: created.id }));
      return created.id;
    }

    const state = (await runAdapterTask(() => adapter.readUIState(), null)) ?? {};
    const lastProjectId =
      typeof (state as { lastProjectId?: unknown }).lastProjectId === "string"
        ? (state as { lastProjectId: string }).lastProjectId
        : null;
    const active = lastProjectId
      ? projects.find((project) => project.id === lastProjectId)
      : null;
    const resolvedProjectId = (active ?? projects[0])?.id ?? "";
    if (resolvedProjectId) {
      await runAdapterVoid(() => adapter.writeUIState({ lastProjectId: resolvedProjectId }));
    }
    return resolvedProjectId;
  };

  const selectFolder = (folderId: string): void => {
    trashOnly = false;
    activeFolderId = folderId;
  };

  const initializeWorkspace = async (): Promise<void> => {
    isLoading = true;
    const ready = await runAdapterVoid(() => adapter.init());
    if (!ready) {
      isLoading = false;
      return;
    }
    projectId = await resolveWorkspaceProjectId();
    if (!projectId) {
      isLoading = false;
      return;
    }
    const storedProject = await runAdapterTask(
      () => adapter.readProject(projectId),
      null
    );
    if (!storedProject) {
      if (!permissionModalId) {
        await goto(resolve("/onboarding"));
      }
      isLoading = false;
      return;
    }
    project = storedProject;
    await loadNotes();
    await loadSearchIndex();
    await restoreWorkspaceState();
    activeFolderId = null;
    isLoading = false;
  };

  onMount(() => {
    void initializeWorkspace();

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
      if (key === "n" && !event.shiftKey) {
        event.preventDefault();
        void createNote();
        return;
      }
      if (key === "f" && event.shiftKey) {
        event.preventDefault();
        openGlobalSearch();
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

  onDestroy(() => {
    adapterUnsubscribe();
    storageModeUnsubscribe();
    modalStackUnsubscribe();
  });

  $: {
    const hasActiveEditor = Boolean(activeNote);
    const resolvedView = resolveMobileView(mobileView, hasActiveEditor);
    if (resolvedView !== mobileView) {
      mobileView = resolvedView;
    }
  }
</script>

<AppShell {saveState} {mobileView} {workspaceMode}>
  <div slot="topbar" class="topbar-content" data-mode={workspaceMode}>
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

    <div class="note-list-filters" aria-label="Note filters">
      <button
        class={`filter-chip${favoritesOnly ? " active" : ""}`}
        type="button"
        aria-pressed={favoritesOnly}
        data-testid="filter-favorites"
        on:click={toggleFavoritesFilter}
      >
        Favorites
      </button>
      <button
        class={`filter-chip${trashOnly ? " active" : ""}`}
        type="button"
        aria-pressed={trashOnly}
        data-testid="filter-trash"
        on:click={toggleTrashFilter}
      >
        Trash
      </button>
    </div>

    {#if isLoading}
      <div class="note-list-empty">Loading notes...</div>
    {:else if filteredNotes.length === 0}
      <div class="note-list-empty">
        <div>{noteListEmptyMessage}</div>
        {#if favoritesOnly || trashOnly}
          <button
            class="button secondary"
            type="button"
            on:click={() => {
              favoritesOnly = false;
              trashOnly = false;
            }}
          >
            Clear filters
          </button>
        {/if}
      </div>
    {:else}
      {#if trashOnly}
        <NoteListVirtualized
          notes={filteredNotes}
          activeNoteId={activeTabId}
          onSelect={noteId => void activateTab(noteId)}
          draggable={false}
        >
          <svelte:fragment slot="row" let:note let:active let:motionEnabled>
            <TrashNoteRow
              note={note as NoteIndexEntry}
              {active}
              {motionEnabled}
              onSelect={noteId => void activateTab(noteId)}
              onRestore={noteId => void restoreTrashedNote(noteId)}
              onDeletePermanent={openPermanentDeleteConfirm}
            />
          </svelte:fragment>
        </NoteListVirtualized>
      {:else}
        <NoteListVirtualized
          notes={filteredNotes}
          activeNoteId={activeTabId}
          onSelect={noteId => void activateTab(noteId)}
          onToggleFavorite={handleFavoriteToggle}
          draggable={true}
          draggingNoteId={draggingNoteId}
          dropTargetNoteId={dropTargetNoteId}
          onDragStart={handleNoteDragStart}
          onDragOver={handleNoteDragOver}
          onDrop={handleNoteDrop}
          onDragEnd={handleNoteDragEnd}
        />
      {/if}
    {/if}
  </div>

  <div
    slot="editor"
    class="editor-content"
    data-split={splitEnabled ? "true" : "false"}
  >
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
              <div class="editor-header-row">
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
                <button
                  class="icon-button editor-favorite"
                  type="button"
                  aria-pressed={paneStates.primary.note?.favorite ?? false}
                  aria-label={
                    paneStates.primary.note?.favorite
                      ? "Remove from favorites"
                      : "Add to favorites"
                  }
                  data-active={paneStates.primary.note?.favorite ? "true" : "false"}
                  data-testid="note-favorite-toggle"
                  on:click={() => toggleFavoriteForPane("primary")}
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
                    <path
                      d="M11.48 3.5c.2-.4.76-.4.96 0l2.2 4.46c.08.17.25.28.43.3l4.93.72c.44.06.62.61.3.92l-3.56 3.47c-.13.13-.19.31-.16.49l.84 4.9c.08.44-.39.78-.78.58l-4.41-2.32a.5.5 0 0 0-.46 0l-4.41 2.32c-.39.2-.86-.14-.78-.58l.84-4.9a.5.5 0 0 0-.16-.49L3.7 9.9c-.32-.31-.14-.86.3-.92l4.93-.72a.5.5 0 0 0 .43-.3z"
                    />
                  </svg>
                </button>
                {#if paneStates.primary.note?.deletedAt === null}
                  <button
                    class="icon-button note-delete"
                    type="button"
                    aria-label="Move note to trash"
                    data-testid="note-delete"
                    on:click={() => deleteNoteFromPane("primary")}
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
                      <path d="M3 6h18" />
                      <path d="M8 6v12" />
                      <path d="M16 6v12" />
                      <path d="M10 6V4h4v2" />
                    </svg>
                  </button>
                {/if}
              </div>
              <div class="chips-row" aria-label="Metadata chips">
                {#each getCustomFieldChips(paneStates.primary.note) as chip (
                  chip.key
                )}
                  <span class="metadata-chip">{chip.label}</span>
                {/each}
              </div>
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
              <div class="editor-header-row">
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
                <button
                  class="icon-button editor-favorite"
                  type="button"
                  aria-pressed={paneStates.secondary.note?.favorite ?? false}
                  aria-label={
                    paneStates.secondary.note?.favorite
                      ? "Remove from favorites"
                      : "Add to favorites"
                  }
                  data-active={paneStates.secondary.note?.favorite ? "true" : "false"}
                  data-testid="note-favorite-toggle-secondary"
                  on:click={() => toggleFavoriteForPane("secondary")}
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
                    <path
                      d="M11.48 3.5c.2-.4.76-.4.96 0l2.2 4.46c.08.17.25.28.43.3l4.93.72c.44.06.62.61.3.92l-3.56 3.47c-.13.13-.19.31-.16.49l.84 4.9c.08.44-.39.78-.78.58l-4.41-2.32a.5.5 0 0 0-.46 0l-4.41 2.32c-.39.2-.86-.14-.78-.58l.84-4.9a.5.5 0 0 0-.16-.49L3.7 9.9c-.32-.31-.14-.86.3-.92l4.93-.72a.5.5 0 0 0 .43-.3z"
                    />
                  </svg>
                </button>
                {#if paneStates.secondary.note?.deletedAt === null}
                  <button
                    class="icon-button note-delete"
                    type="button"
                    aria-label="Move note to trash"
                    data-testid="note-delete-secondary"
                    on:click={() => deleteNoteFromPane("secondary")}
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
                      <path d="M3 6h18" />
                      <path d="M8 6v12" />
                      <path d="M16 6v12" />
                      <path d="M10 6V4h4v2" />
                    </svg>
                  </button>
                {/if}
              </div>
              <div class="chips-row" aria-label="Metadata chips">
                {#each getCustomFieldChips(paneStates.secondary.note) as chip (
                  chip.key
                )}
                  <span class="metadata-chip">{chip.label}</span>
                {/each}
              </div>
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
            <div class="editor-header-row">
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
              <button
                class="icon-button editor-favorite"
                type="button"
                aria-pressed={paneStates.primary.note?.favorite ?? false}
                aria-label={
                  paneStates.primary.note?.favorite
                    ? "Remove from favorites"
                    : "Add to favorites"
                }
                data-active={paneStates.primary.note?.favorite ? "true" : "false"}
                data-testid="note-favorite-toggle"
                on:click={() => toggleFavoriteForPane("primary")}
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
                  <path
                    d="M11.48 3.5c.2-.4.76-.4.96 0l2.2 4.46c.08.17.25.28.43.3l4.93.72c.44.06.62.61.3.92l-3.56 3.47c-.13.13-.19.31-.16.49l.84 4.9c.08.44-.39.78-.78.58l-4.41-2.32a.5.5 0 0 0-.46 0l-4.41 2.32c-.39.2-.86-.14-.78-.58l.84-4.9a.5.5 0 0 0-.16-.49L3.7 9.9c-.32-.31-.14-.86.3-.92l4.93-.72a.5.5 0 0 0 .43-.3z"
                  />
                </svg>
              </button>
              {#if paneStates.primary.note?.deletedAt === null}
                <button
                  class="icon-button note-delete"
                  type="button"
                  aria-label="Move note to trash"
                  data-testid="note-delete"
                  on:click={() => deleteNoteFromPane("primary")}
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
                    <path d="M3 6h18" />
                    <path d="M8 6v12" />
                    <path d="M16 6v12" />
                    <path d="M10 6V4h4v2" />
                  </svg>
                </button>
              {/if}
            </div>
            <div class="chips-row" aria-label="Metadata chips">
              {#each getCustomFieldChips(paneStates.primary.note) as chip (
                chip.key
              )}
                <span class="metadata-chip">{chip.label}</span>
              {/each}
            </div>
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
  </div>

  <RightPanel
    slot="right-panel"
    activeTab={rightPanelTab}
    activeNoteId={activeNote?.id ?? null}
    activeNote={activeNote}
    {project}
    linkedMentions={linkedMentions}
    backlinksLoading={backlinksLoading}
    onOpenNote={activateTab}
    onUpdateCustomFields={updateCustomFieldsForNote}
  />

  <ModalHost
    slot="modal"
    {project}
    notes={notes}
    activeNoteId={activeTabId}
    {searchState}
    onOpenNote={activateTab}
    onCreateNote={createNote}
    onOpenGlobalSearch={openGlobalSearch}
    onToggleSplitView={toggleSplitView}
    onToggleRightPanel={handleRightPanelTabSelect}
    onGoToTrash={openTrashView}
  />

  <ToastHost slot="toast" />

  <div slot="bottom-nav" class="mobile-nav-content">
    <button
      class="mobile-nav-button"
      class:active={workspaceMode === "notes" && mobileView === "notes"}
      type="button"
      data-testid="mobile-nav-notes"
      aria-pressed={workspaceMode === "notes" && mobileView === "notes"}
      on:click={() => {
        workspaceMode = "notes";
        setMobileView("notes");
      }}
    >
      Notes
    </button>
    {#if hasActiveEditor}
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

  .tab-close:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
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

  .icon-button[aria-pressed="true"] {
    background: var(--bg-2);
    color: var(--text-0);
  }

  .icon-button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
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

  .sidebar-view:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
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
    min-height: 44px;
  }

  .note-list-filters {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
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
    display: flex;
    flex-direction: column;
    gap: 12px;
    color: var(--text-2);
    font-size: 13px;
  }

  .filter-chip {
    height: 32px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--stroke-0);
    background: transparent;
    color: var(--text-1);
    cursor: pointer;
  }

  .filter-chip.active {
    background: var(--accent-2);
    color: var(--text-0);
    border-color: transparent;
  }

  .filter-chip:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .editor-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
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

  .editor-header-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .editor-header-row .title-input {
    flex: 1;
    min-width: 0;
    width: auto;
  }

  .title-input {
    font-size: 22px;
    font-weight: 500;
    line-height: 1.2;
  }

  .editor-favorite[data-active="true"] {
    color: var(--accent-0);
  }

  .editor-favorite[data-active="true"] .icon {
    fill: currentColor;
  }

  .note-delete:hover {
    color: var(--danger);
  }

  .chips-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .metadata-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: var(--r-sm);
    border: 1px solid var(--stroke-0);
    background: var(--bg-2);
    color: var(--text-1);
    font-size: 12px;
    line-height: 1.2;
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
    height: 32px;
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    color: var(--text-0);
    padding: 0 12px;
  }

  .field-input:focus,
  .field-input:focus {
    border-color: rgba(255, 138, 42, 0.4);
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .field-input::placeholder {
    color: var(--text-2);
  }

  .button {
    height: 32px;
    padding: 0 14px;
    border-radius: var(--r-md);
    border: 1px solid transparent;
    cursor: pointer;
  }

  .button.secondary {
    background: transparent;
    border-color: var(--stroke-1);
    color: var(--text-0);
  }

  .button.secondary:hover:enabled {
    background: var(--bg-3);
  }

  .button.secondary:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .button.primary {
    background: var(--accent-0);
    color: #0b0d10;
  }

  .button.primary:hover:enabled {
    background: var(--accent-1);
  }

  .button.primary:active:enabled {
    transform: translateY(0.5px);
    filter: brightness(0.96);
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

  .mobile-nav-button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .mobile-nav-button:disabled {
    color: var(--text-2);
    cursor: not-allowed;
    opacity: 0.7;
  }

</style>
