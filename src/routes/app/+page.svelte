<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { get } from "svelte/store";
  import { ChevronLeft, HelpCircle, Search, Settings, X } from "lucide-svelte";
  import AppShell from "$lib/components/AppShell.svelte";
  import ToastHost from "$lib/components/ToastHost.svelte";
  import RightPanel from "$lib/components/rightpanel/RightPanel.svelte";
  import RightPanelTabs from "$lib/components/rightpanel/RightPanelTabs.svelte";
  import ModalHost from "$lib/components/modals/ModalHost.svelte";
  import EditorPaneLayout from "$lib/components/panes/EditorPaneLayout.svelte";
  import NoteListVirtualized from "$lib/components/notes/NoteListVirtualized.svelte";
  import FolderTree from "$lib/components/sidebar/FolderTree.svelte";
  import { createEmptyDocument } from "$lib/core/editor/tiptap-config";
  import {
    ensureTitleHeadingInPmDocument,
    extractTitleFromPmDocument,
    setTitleInPmDocument,
    splitEditorTextIntoTitleAndBody,
  } from "$lib/core/editor/title-line";
  import { resolveOutgoingLinks } from "$lib/core/editor/links/parse";
  import {
    buildBacklinkSnippet,
    resolveLinkedMentions,
    type BacklinkSnippet,
  } from "$lib/core/editor/links/backlinks";
  import { buildUnlinkedMentionSnippet } from "$lib/core/editor/links/unlinked-mentions";
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
  import { resolveNoteListTitle } from "$lib/core/utils/note-list-title";
  import { toDerivedMarkdown } from "$lib/core/utils/derived-markdown";
  import { resolveInterfaceDensity } from "$lib/core/utils/interface-density";
  import { resolveAccentColor } from "$lib/core/utils/accent-color";
  import { exportVaultToDirectory } from "$lib/core/utils/vault-export";
  import {
    createVaultBackup,
    mergeVaultBackups,
    parseVaultBackup,
    restoreVaultBackup,
    serializeVaultBackup,
    triggerBrowserDownload,
  } from "$lib/core/utils/vault-backup";
  import { importMarkdownToNote } from "$lib/core/utils/markdown-import";
  import {
    applyVaultIntegrityRepairs,
    runVaultIntegrityCheck,
    type VaultIntegrityReport,
  } from "$lib/core/utils/vault-integrity";
  import { createUlid } from "$lib/core/utils/ulid";
  import { createDebouncedTask } from "$lib/core/utils/debounce";
  import { hashBlobSha256 } from "$lib/core/utils/hash";
  import { formatCustomFieldValue } from "$lib/core/utils/custom-fields";
  import {
    isDirectoryHandle,
    isFileHandle,
    isNotFoundError,
  } from "$lib/core/storage/filesystem/handles";
  import {
    addTab,
    closeTabState,
    reorderTabs,
  } from "$lib/core/utils/tabs";
  import {
    createLeaf,
    type PaneLayoutNode,
  } from "$lib/core/utils/pane-layout";
  import {
    applySearchIndexChange,
    type SearchIndexState,
  } from "$lib/state/search.store";
  import {
    buildSearchIndex,
    loadSearchIndex as loadMiniSearchIndex,
    serializeSearchIndex,
  } from "$lib/core/search/minisearch";
  import {
    closeModal,
    modalStackStore,
    openModal,
    dismissToast,
    pushToast,
  } from "$lib/state/ui.store";
  import { dispatchEditorCommand } from "$lib/state/editor-commands.store";
  import {
    resolveMobileView,
    type MobileView,
  } from "$lib/core/utils/mobile-view";
  import { openAllNotesView as openAllNotesViewFilters } from "$lib/core/utils/notes-view";
  import {
    adapter as adapterStore,
    initAdapter,
    initAdapterAsync,
    storageMode as storageModeStore,
    type StorageMode,
  } from "$lib/state/adapter.store";
  import {
    IndexedDBAdapter,
    createDefaultVault,
  } from "$lib/core/storage/indexeddb.adapter";
  import { FileSystemAdapter } from "$lib/core/storage/filesystem.adapter";
  import { normalizeS3ConfigInput } from "$lib/core/storage/s3/config";
  import {
    readAppSettings,
    writeAppSettings,
  } from "$lib/core/storage/app-settings";
  import type {
    AssetMeta,
    AppSettings,
    AppPreferences,
    CustomFieldValue,
    NoteDocumentFile,
    NoteIndexEntry,
    S3Config,
    SyncStatus,
    Vault,
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
  let settingsModalId: string | null = null;
  let helpModalId: string | null = null;
  let appSettings: AppSettings | null = null;
  let supportsFileSystem = false;
  let projectsOverlayOpen = false;
  let projectsOverlayLeft = 0;
  let noteListElement: HTMLDivElement | null = null;
  const mobileBreakpoint = 767;
  const rightPanelOverlayBreakpoint = 1100;
  let viewportWidth = Number.POSITIVE_INFINITY;
  let isMobileViewport = false;
  let isRightPanelOverlayViewport = false;
  let mobileRightPanelOpen = false;
  let modalStackEntries: { id: string }[] = [];
  const modalStackUnsubscribe = modalStackStore.subscribe((stack) => {
    modalStackEntries = stack;
    if (
      permissionModalId &&
      !modalStackEntries.some((entry) => entry.id === permissionModalId)
    ) {
      permissionModalId = null;
    }
    if (
      settingsModalId &&
      !modalStackEntries.some((entry) => entry.id === settingsModalId)
    ) {
      settingsModalId = null;
    }
    if (
      helpModalId &&
      !modalStackEntries.some((entry) => entry.id === helpModalId)
    ) {
      helpModalId = null;
    }
  });

  type PaneId = string;

  type PaneState = {
    tabs: string[];
    activeTabId: string | null;
    note: NoteDocumentFile | null;
    titleValue: string;
    editorContent: Record<string, unknown>;
    editorPlainText: string;
    tabViewModes: Record<string, "editor" | "markdown">;
  };

  type RightPanelTab = "outline" | "metadata";

  const createPaneState = (): PaneState => ({
    tabs: [],
    activeTabId: null,
    note: null,
    titleValue: "",
    editorContent: createEmptyDocument(),
    editorPlainText: "",
    tabViewModes: {},
  });

  let vault: Vault | null = null;
  let notes: NoteIndexEntry[] = [];
  let activeNotes: NoteIndexEntry[] = [];
  let filteredNotes: NoteIndexEntry[] = [];
  let activePane: PaneId = "primary";
  let favoriteOverrides: Record<string, boolean> = {};
  let titleOverrides: Record<string, string> = {};
  let paneLayout: PaneLayoutNode = createLeaf("primary");
  let paneStates: Record<PaneId, PaneState> = {
    primary: createPaneState(),
  };
  let activePaneState: PaneState = paneStates[activePane];
  let activeNote: NoteDocumentFile | null = null;
  let activeTabId: string | null = null;
  let activeTabs: string[] = [];
  let tabTitles: Record<string, string> = {};
  let draggingTabId: string | null = null;
  let dropTargetTabId: string | null = null;
  let draggingNoteId: string | null = null;
  let dropTargetNoteId: string | null = null;
  let isLoading = true;
  let saveState: "idle" | "saving" | "saved" = "idle";
  let mobileView: MobileView = "notes";
  let workspaceMode: "notes" = "notes";
  let activeFolderId: string | null = null;
  let favoritesOnly = false;
  let searchState: SearchIndexState | null = null;
  let wikiLinkCandidates: WikiLinkCandidate[] = [];
  let rightPanelTab: RightPanelTab = "outline";
  type BacklinkEntry = { id: string; title: string; snippet: BacklinkSnippet | null };
  let linkedMentions: BacklinkEntry[] = [];
  let unlinkedMentions: BacklinkEntry[] = [];
  let backlinksLoading = false;
  let unlinkedMentionsLoading = false;
  let backlinksRequestSeq = 0;
  let backlinksTargetId: string | null = null;
  let backlinksTargetTitle: string | null = null;
  type StartupStage =
    | "idle"
    | "s3_connecting"
    | "vault_loading"
    | "workspace_restoring"
    | "ready"
    | "search_indexing_bg"
    | "failed";
  type StartupState = {
    stage: StartupStage;
    attempt: number;
    maxAttempts: number;
    error: string | null;
    blocking: boolean;
  };
  const s3StartupMaxAttempts = 3;
  const s3StartupRequestTimeoutMs = 7000;
  const s3StartupBackoffMs = [800, 1600, 3200] as const;
  const startupStageLabels: Record<StartupStage, string> = {
    idle: "Starting app...",
    s3_connecting: "Connecting to S3...",
    vault_loading: "Loading vault...",
    workspace_restoring: "Restoring workspace...",
    ready: "Ready",
    search_indexing_bg: "Indexing notes in background...",
    failed: "Could not connect to S3.",
  };
  const createDefaultStartupState = (): StartupState => ({
    stage: "idle",
    attempt: 0,
    maxAttempts: s3StartupMaxAttempts,
    error: null,
    blocking: false,
  });
  const createDefaultSyncStatus = (): SyncStatus => ({
    state: "idle",
    pendingCount: 0,
    lastSuccessAt: null,
    lastError: null,
    lastInitResolution: null,
  });
  let startupState: StartupState = createDefaultStartupState();
  let s3StartupConfig: S3Config | null = null;
  let syncStatus: SyncStatus = createDefaultSyncStatus();
  let syncStatusPoller: number | null = null;
  let syncStatusRequestInFlight = false;
  let searchIndexReady = false;
  let searchIndexLoading = false;
  let searchIndexBackgroundTask: Promise<void> | null = null;
  let mobileKeyboardInset = 0;
  let startupStageLabel = startupStageLabels.idle;
  let startupOverlayVisible = false;
  let syncBadgeLabel = "Idle";
  let syncBadgeDetail = "No pending changes";
  let syncInitResolutionLabel: string | null = null;

  const saveDelay = 400;
  const uiStateDelay = 800;
  const permissionErrorNames = new Set(["NotAllowedError", "SecurityError"]);
  let isRecoveringStorage = false;
  let isExportingVault = false;
  let isImportingFromFolder = false;
  let isBackingUpVault = false;
  let isRestoringBackup = false;
  const defaultTabViewMode = (): "editor" | "markdown" =>
    preferences.markdownViewByDefault ? "markdown" : "editor";

  type NoteSaveTask = ReturnType<typeof createDebouncedTask<[NoteDocumentFile]>>;
  const saveTasks: Record<string, NoteSaveTask> = {};
  const pendingSaveIds: Record<string, true> = {};
  let pendingSaveCount = 0;

  // IndexedDB adapter writes update the vault index via a read-modify-write
  // cycle, so concurrent writes can clobber each other. Serialize adapter writes
  // to keep the vault metadata consistent.
  let adapterWriteQueue: Promise<void> = Promise.resolve();
  const enqueueAdapterWrite = async (
    operation: () => Promise<void>
  ): Promise<void> => {
    const next = adapterWriteQueue
      .catch(() => {
        // Keep the queue alive even if a prior write failed.
      })
      .then(operation);
    adapterWriteQueue = next;
    await next;
  };

  $: activePaneState = paneStates[activePane] ?? createPaneState();
  $: activeNote = activePaneState.note;
  $: activeTabId = activePaneState.activeTabId;
  $: activeTabs = activePaneState.tabs;
  $: hasActiveEditor = Boolean(activeNote);
  $: wikiLinkCandidates = notes
    .filter((note) => note.deletedAt === null)
    .map((note) => ({ id: note.id, title: note.title }));

  const loadBacklinksForTarget = async (input: {
    targetId: string;
    targetTitle: string;
  }): Promise<void> => {
    const requestId = (backlinksRequestSeq += 1);
    backlinksLoading = true;
    unlinkedMentionsLoading = true;
    linkedMentions = [];
    unlinkedMentions = [];

    const targets = [input.targetId, input.targetTitle].filter(
      (value): value is string => Boolean(value && value.trim())
    );

    const linked = resolveLinkedMentions(
      notes,
      input.targetId,
      input.targetTitle
    );
    const linkedEntries: BacklinkEntry[] = [];
    for (const entry of linked) {
      let noteDoc: NoteDocumentFile | null = null;
      try {
         
        noteDoc = await adapter.readNote(entry.id);
      } catch {
        noteDoc = null;
      }
      const text = noteDoc?.derived?.plainText ?? "";
      const snippet = buildBacklinkSnippet(text, targets);
      linkedEntries.push({ id: entry.id, title: entry.title, snippet });
      if (requestId !== backlinksRequestSeq) {
        return;
      }
    }
    linkedMentions = linkedEntries;
    backlinksLoading = false;

    const targetTitle = input.targetTitle.trim();
    if (!targetTitle) {
      unlinkedMentionsLoading = false;
      return;
    }

    const linkedIdSet = new Set(linkedEntries.map((item) => item.id));
    const unlinkedEntries: BacklinkEntry[] = [];
    for (const candidate of notes) {
      if (candidate.deletedAt !== null) {
        continue;
      }
      if (candidate.id === input.targetId) {
        continue;
      }
      if (linkedIdSet.has(candidate.id)) {
        continue;
      }
      let noteDoc: NoteDocumentFile | null = null;
      try {
         
        noteDoc = await adapter.readNote(candidate.id);
      } catch {
        noteDoc = null;
      }
      const text = noteDoc?.derived?.plainText ?? "";
      if (!text) {
        continue;
      }
      if (text.includes(`[[${input.targetId}]]`)) {
        continue;
      }
      const snippet = buildUnlinkedMentionSnippet(text, targetTitle);
      if (snippet) {
        unlinkedEntries.push({
          id: candidate.id,
          title: candidate.title,
          snippet,
        });
      }
      if (requestId !== backlinksRequestSeq) {
        return;
      }
    }
    unlinkedMentions = unlinkedEntries;
    unlinkedMentionsLoading = false;
  };

  const clearBacklinksState = (): void => {
    backlinksTargetId = null;
    backlinksTargetTitle = null;
    backlinksRequestSeq += 1;
    backlinksLoading = false;
    unlinkedMentionsLoading = false;
    linkedMentions = [];
    unlinkedMentions = [];
  };

  const refreshBacklinksForNote = (note: NoteDocumentFile | null): void => {
    if (rightPanelTab !== "metadata" || !note) {
      clearBacklinksState();
      return;
    }

    const nextId = note.id;
    const nextTitle = note.title ?? "";
    if (nextId === backlinksTargetId && nextTitle === backlinksTargetTitle) {
      return;
    }

    backlinksTargetId = nextId;
    backlinksTargetTitle = nextTitle;
    void loadBacklinksForTarget({
      targetId: nextId,
      targetTitle: nextTitle,
    });
  };

  const resolveWikiLinkInActiveNote = async (
    raw: string,
    targetId: string
  ): Promise<void> => {
    if (!activeNote) {
      return;
    }
    dispatchEditorCommand({
      id: createUlid(),
      noteId: activeNote.id,
      type: "replace-wiki-link",
      raw,
      targetId,
    });
    pushToast("Link resolved.", { tone: "success" });
  };

  const normalizeWikiLinksInActiveNote = async (
    replacements: Array<{ raw: string; targetId: string }>
  ): Promise<void> => {
    if (!activeNote) {
      return;
    }
    if (replacements.length === 0) {
      return;
    }
    dispatchEditorCommand({
      id: createUlid(),
      noteId: activeNote.id,
      type: "replace-wiki-links",
      replacements,
    });
    pushToast("Links converted to stable IDs.", { tone: "success" });
  };

  const createNoteForWikiLink = async (title: string): Promise<string> => {
    if (!vault) {
      pushToast("No vault loaded.", { tone: "error" });
      return "";
    }
    const trimmed = title.trim();
    if (!trimmed) {
      return "";
    }
    const timestamp = Date.now();
    const noteId = createUlid();
    const pmDoc = setTitleInPmDocument({
      pmDocument: createEmptyDocument(),
      title: trimmed,
    });
    const note: NoteDocumentFile = {
      id: noteId,
      title: trimmed,
      createdAt: timestamp,
      updatedAt: timestamp,
      folderId: null,
      tagIds: [],
      favorite: false,
      deletedAt: null,
      customFields: {},
      pmDoc,
      derived: {
        plainText: "",
        outgoingLinks: [],
      },
    };
    await persistNote(note);
    await loadNotes();
    return noteId;
  };

  const isPermissionError = (error: unknown): boolean =>
    error instanceof Error && permissionErrorNames.has(error.name);

  const isAbortError = (error: unknown): boolean =>
    error instanceof Error && error.name === "AbortError";

  const isCloneError = (error: unknown): boolean =>
    (error instanceof DOMException && error.name === "DataCloneError") ||
    (error instanceof Error && error.message.includes("could not be cloned"));

  const getEphemeralHandle = (): FileSystemDirectoryHandle | null => {
    if (typeof window === "undefined") {
      return null;
    }
    const globalWithHandle = globalThis as typeof globalThis & {
      __emberVaultFsHandle?: FileSystemDirectoryHandle;
    };
    return globalWithHandle.__emberVaultFsHandle ?? null;
  };

  const setEphemeralHandle = (handle?: FileSystemDirectoryHandle): void => {
    if (typeof window === "undefined") {
      return;
    }
    const globalWithHandle = globalThis as typeof globalThis & {
      __emberVaultFsHandle?: FileSystemDirectoryHandle;
    };
    if (handle) {
      globalWithHandle.__emberVaultFsHandle = handle;
      return;
    }
    delete globalWithHandle.__emberVaultFsHandle;
  };

  const supportsFileSystemAccess = (): boolean =>
    typeof window !== "undefined" &&
    typeof window.showDirectoryPicker === "function";

  const defaultPreferences: AppPreferences = {
    startupView: "last-opened",
    defaultSort: "updated",
    openNoteBehavior: "new-tab",
    newNoteLocation: "current-folder",
    confirmTrash: true,
    spellcheck: true,
    showNoteDates: true,
    showNotePreview: true,
    showTagPillsInList: true,
    markdownViewByDefault: false,
    smartListContinuation: false,
    interfaceDensity: "comfortable",
    accentColor: "orange",
  };

  const resolvePreferences = (
    settings: AppSettings["settings"] | null | undefined
  ): AppPreferences => {
    const input = settings ?? defaultPreferences;
    return {
      startupView: input.startupView === "all-notes" ? "all-notes" : "last-opened",
      defaultSort:
        input.defaultSort === "created" || input.defaultSort === "title"
          ? input.defaultSort
          : "updated",
      openNoteBehavior:
        input.openNoteBehavior === "reuse-tab" ? "reuse-tab" : "new-tab",
      newNoteLocation:
        input.newNoteLocation === "all-notes" ? "all-notes" : "current-folder",
      confirmTrash: input.confirmTrash !== false,
      spellcheck: input.spellcheck !== false,
      showNoteDates: input.showNoteDates !== false,
      showNotePreview: input.showNotePreview !== false,
      showTagPillsInList: input.showTagPillsInList !== false,
      markdownViewByDefault: input.markdownViewByDefault === true,
      smartListContinuation: input.smartListContinuation === true,
      interfaceDensity: resolveInterfaceDensity(input.interfaceDensity),
      accentColor: resolveAccentColor(input.accentColor),
    };
  };

  let preferences: AppPreferences = defaultPreferences;
  let lastSortMode: AppPreferences["defaultSort"] =
    defaultPreferences.defaultSort;

  const applyAccentColorToRoot = (accentColor: AppPreferences["accentColor"]) => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    if (accentColor && accentColor !== "orange") {
      root.setAttribute("data-accent", accentColor);
      return;
    }
    root.removeAttribute("data-accent");
  };

  $: applyAccentColorToRoot(preferences.accentColor);

  const loadAppSettings = async (): Promise<AppSettings | null> => {
    appSettings = await readAppSettings();
    preferences = resolvePreferences(appSettings?.settings);
    return appSettings;
  };

  const persistStorageChoice = async (
    mode: StorageMode,
    options: { handle?: FileSystemDirectoryHandle; s3?: S3Config } = {}
  ): Promise<void> => {
    const nextSettings: AppSettings = {
      storageMode: mode,
      fsHandle: mode === "filesystem" ? options.handle : undefined,
      s3: mode === "s3" ? options.s3 : undefined,
      lastVaultName:
        mode === "filesystem"
          ? options.handle?.name
          : mode === "s3"
            ? options.s3?.bucket
            : undefined,
      settings: appSettings?.settings ?? preferences,
    };
    setEphemeralHandle(mode === "filesystem" ? options.handle : undefined);
    try {
      await writeAppSettings(nextSettings);
      appSettings = nextSettings;
      return;
    } catch (error) {
      if (mode !== "filesystem" || !isCloneError(error)) {
        throw error;
      }
      const fallbackSettings: AppSettings = {
        ...nextSettings,
        fsHandle: undefined,
      };
      await writeAppSettings(fallbackSettings);
      appSettings = fallbackSettings;
    }
  };

  const getErrorMessage = (
    error: unknown,
    fallback: string = "Please retry."
  ): string => {
    if (!(error instanceof Error)) {
      return fallback;
    }
    const message = error.message.trim();
    return message.length > 0 ? message : fallback;
  };

  const waitForDelay = async (ms: number): Promise<void> => {
    if (!Number.isFinite(ms) || ms <= 0) {
      return;
    }
    await new Promise<void>((resolveDelay) => {
      setTimeout(resolveDelay, ms);
    });
  };

  const setStartupState = (patch: Partial<StartupState>): void => {
    startupState = {
      ...startupState,
      ...patch,
    };
  };

  const resetStartupState = (): void => {
    startupState = createDefaultStartupState();
  };

  const formatSyncTimestamp = (timestamp: number | null): string => {
    if (!timestamp) {
      return "Never";
    }
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return "Unknown";
    }
  };

  const syncStateLabel = (state: SyncStatus["state"]): string => {
    if (state === "syncing") {
      return "Syncing";
    }
    if (state === "offline") {
      return "Offline";
    }
    if (state === "error") {
      return "Needs attention";
    }
    return "Idle";
  };

  const syncInitResolutionText = (
    resolution: SyncStatus["lastInitResolution"]
  ): string | null => {
    if (resolution === "remote_applied") {
      return "Startup reconciliation: remote applied";
    }
    if (resolution === "local_pushed") {
      return "Startup reconciliation: local pushed";
    }
    if (resolution === "created_default") {
      return "Startup reconciliation: new vault created";
    }
    return null;
  };

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

  const handleExportVault = async (): Promise<void> => {
    if (typeof window === "undefined") {
      return;
    }
    if (!vault) {
      pushToast("Nothing to export yet.", { tone: "error" });
      return;
    }
    if (isExportingVault) {
      return;
    }
    if (typeof window.showDirectoryPicker !== "function") {
      pushToast("Export requires a Chromium browser (Chrome/Edge).", {
        tone: "error",
      });
      return;
    }

    isExportingVault = true;
    const toastId = pushToast("Exporting vault...", { durationMs: 0 });
    try {
      const directory = await window.showDirectoryPicker();
      await flushPendingSave();
      await exportVaultToDirectory({ vault, adapter, directory });
      dismissToast(toastId);
      pushToast("Export complete.", { tone: "success" });
    } catch (error) {
      dismissToast(toastId);
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      pushToast("Export failed. Please retry.", { tone: "error" });
    } finally {
      isExportingVault = false;
    }
  };

  const handleDownloadBackup = async (): Promise<void> => {
    if (typeof window === "undefined") {
      return;
    }
    if (!vault) {
      pushToast("Nothing to back up yet.", { tone: "error" });
      return;
    }
    if (isBackingUpVault) {
      return;
    }

    isBackingUpVault = true;
    const toastId = pushToast("Preparing backup...", { durationMs: 0 });
    try {
      await flushPendingSave();
      const backup = await createVaultBackup({ adapter, vault });
      const { blob, fileName } = await serializeVaultBackup({ backup });
      triggerBrowserDownload({ blob, fileName });
      dismissToast(toastId);
      pushToast("Backup downloaded.", { tone: "success" });
    } catch (error) {
      dismissToast(toastId);
      pushToast("Backup failed. Please retry.", { tone: "error" });
    } finally {
      isBackingUpVault = false;
    }
  };

  const handleRestoreBackup = (file: File): void => {
    if (isRestoringBackup) {
      return;
    }
    openModal("confirm", {
      title: "Restore backup",
      message:
        "Restoring will replace the current vault contents. This can't be undone.",
      confirmLabel: "Restore",
      cancelLabel: "Cancel",
      destructive: true,
      onConfirm: async () => {
        closeSettings();
        isRestoringBackup = true;
        isLoading = true;
        const toastId = pushToast("Restoring backup...", { durationMs: 0 });
        try {
          await flushPendingSave();
          const backup = await parseVaultBackup({ file });
          await enqueueAdapterWrite(async () => {
            await restoreVaultBackup({ adapter, backup });
          });
          await initializeWorkspace();
          await rebuildSearchIndex();
          await clearWorkspaceState();
          dismissToast(toastId);
          pushToast("Backup restored.", { tone: "success" });
        } catch (error) {
          dismissToast(toastId);
          pushToast("Restore failed. Please retry.", { tone: "error" });
        } finally {
          isRestoringBackup = false;
          isLoading = false;
        }
      },
    });
  };

  const ensureImportedFolderPath = (
    folders: Vault["folders"],
    segments: string[]
  ): { folders: Vault["folders"]; folderId: string | null } => {
    const normalized = segments
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
    if (normalized.length === 0) {
      return { folders, folderId: null };
    }

    let nextFolders = folders;
    const findChildByName = (
      parentId: string | null,
      name: string
    ): string | null => {
      const match = Object.values(nextFolders).find(
        (folder) => folder.parentId === parentId && folder.name === name
      );
      return match?.id ?? null;
    };
    let parentId: string | null = null;
    for (const segment of normalized) {
      const existingId = findChildByName(parentId, segment);
      if (existingId) {
        parentId = existingId;
        continue;
      }
      const id = createUlid();
      nextFolders = addFolder(nextFolders, { id, name: segment, parentId });
      parentId = id;
    }
    return { folders: nextFolders, folderId: parentId };
  };

  type ImportMarkdownEntry = {
    handle: FileSystemFileHandle;
    folderSegments: string[];
    fileName: string;
  };

  const walkDirectoryForMarkdown = async (
    directory: FileSystemDirectoryHandle,
    prefixSegments: string[] = []
  ): Promise<ImportMarkdownEntry[]> => {
    const entries: ImportMarkdownEntry[] = [];
    const iterator = directory.values();
    for await (const entry of iterator) {
      if (isDirectoryHandle(entry)) {
        entries.push(
          ...(await walkDirectoryForMarkdown(entry, [
            ...prefixSegments,
            entry.name,
          ]))
        );
        continue;
      }
      if (!isFileHandle(entry)) {
        continue;
      }
      const name = entry.name ?? "";
      if (!name.toLowerCase().endsWith(".md")) {
        continue;
      }
      entries.push({
        handle: entry,
        folderSegments: prefixSegments,
        fileName: name,
      });
    }
    return entries;
  };

  const tryGetSubdirectory = async (
    directory: FileSystemDirectoryHandle,
    name: string
  ): Promise<FileSystemDirectoryHandle | null> => {
    const getter = directory.getDirectoryHandle;
    if (typeof getter !== "function") {
      return null;
    }
    try {
      return await getter.call(directory, name);
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  };

  const resolveImportRoots = async (
    directory: FileSystemDirectoryHandle
  ): Promise<{
    notesRoot: FileSystemDirectoryHandle;
    assetsRoot: FileSystemDirectoryHandle | null;
  }> => {
    const directNotes = await tryGetSubdirectory(directory, "notes");
    if (directNotes) {
      return {
        notesRoot: directNotes,
        assetsRoot: await tryGetSubdirectory(directory, "assets"),
      };
    }

    const childDirectories: FileSystemDirectoryHandle[] = [];
    for await (const entry of directory.values()) {
      if (isDirectoryHandle(entry)) {
        childDirectories.push(entry);
      }
    }

    if (childDirectories.length === 1) {
      const nestedRoot = childDirectories[0];
      const nestedNotes = await tryGetSubdirectory(nestedRoot, "notes");
      if (nestedNotes) {
        return {
          notesRoot: nestedNotes,
          assetsRoot: await tryGetSubdirectory(nestedRoot, "assets"),
        };
      }
    }

    return {
      notesRoot: directory,
      assetsRoot: await tryGetSubdirectory(directory, "assets"),
    };
  };

  const handleImportFromFolder = async (): Promise<void> => {
    if (typeof window === "undefined") {
      return;
    }
    if (!vault) {
      pushToast("Nothing to import into yet.", { tone: "error" });
      return;
    }
    if (isImportingFromFolder) {
      return;
    }
    if (typeof window.showDirectoryPicker !== "function") {
      pushToast("Import requires a Chromium browser (Chrome/Edge).", {
        tone: "error",
      });
      return;
    }

    isImportingFromFolder = true;
    const toastId = pushToast("Importing notes...", { durationMs: 0 });
    try {
      const directory = await window.showDirectoryPicker();
      await flushPendingSave();

      const { notesRoot, assetsRoot } = await resolveImportRoots(directory);

      const markdownFiles = await walkDirectoryForMarkdown(notesRoot);

      // Build any missing folders first and persist the folder tree.
      const folderKey = (segments: string[]): string => segments.join("/");
      const folderIdByKey: Record<string, string | null> = {};
      let nextFolders = vault.folders;
      for (const entry of markdownFiles) {
        const key = folderKey(entry.folderSegments);
        if (Object.prototype.hasOwnProperty.call(folderIdByKey, key)) {
          continue;
        }
        const ensured = ensureImportedFolderPath(nextFolders, entry.folderSegments);
        nextFolders = ensured.folders;
        folderIdByKey[key] = ensured.folderId;
      }

      if (nextFolders !== vault.folders) {
        await persistVault({
          ...vault,
          folders: nextFolders,
          updatedAt: Date.now(),
        });
      }

      // Import notes sequentially; the IndexedDB adapter relies on serialized writes.
      let importedNotes = 0;
      await enqueueAdapterWrite(async () => {
        for (const entry of markdownFiles) {
          const file = await entry.handle.getFile();
          const markdown = await file.text();
          const parsed = importMarkdownToNote({
            fileName: entry.fileName,
            markdown,
          });
          const folderId =
            folderIdByKey[folderKey(entry.folderSegments)] ?? null;
          const noteId = createUlid();
          const timestamp = file.lastModified || Date.now();
          const note: NoteDocumentFile = {
            id: noteId,
            title: parsed.title,
            createdAt: timestamp,
            updatedAt: timestamp,
            folderId,
            tagIds: [],
            favorite: false,
            deletedAt: null,
            customFields: {},
            pmDoc: parsed.pmDocument,
            derived: {
              plainText: parsed.plainText,
              outgoingLinks: [],
            },
          };

          const stored = await runAdapterVoid(() =>
            adapter.writeNote({
              noteId,
              noteDocument: note,
              derivedMarkdown: markdown,
            })
          );
          if (stored) {
            importedNotes += 1;
            await updateSearchIndexForDocument(note);
          }
        }

        if (assetsRoot) {
          const iterator = assetsRoot.values();
          for await (const entry of iterator) {
            if (!isFileHandle(entry)) {
              continue;
            }
            const file = await entry.getFile();
            const assetId = await hashBlobSha256(file);
            await runAdapterVoid(() =>
              adapter.writeAsset({
                assetId,
                blob: file,
                meta: { mime: file.type, size: file.size },
              })
            );
          }
        }
      });

      await loadNotes();
      dismissToast(toastId);
      pushToast(
        importedNotes > 0
          ? `Imported ${importedNotes} note${importedNotes === 1 ? "" : "s"}.`
          : "No Markdown files found.",
        { tone: importedNotes > 0 ? "success" : "info" }
      );
    } catch (error) {
      dismissToast(toastId);
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      pushToast("Import failed. Please retry.", { tone: "error" });
    } finally {
      isImportingFromFolder = false;
    }
  };

  const handleNonBlockingAdapterError = (error: unknown): void => {
    if (isAbortError(error)) {
      return;
    }
    console.error("Storage adapter error:", error);
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
        await switchToBrowserStorage({ notifyFallback: true });
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
    console.warn("Storage permission error:", error);
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

  const refreshSyncStatus = async (): Promise<void> => {
    if (activeStorageMode !== "s3") {
      syncStatus = createDefaultSyncStatus();
      return;
    }
    if (syncStatusRequestInFlight) {
      return;
    }
    syncStatusRequestInFlight = true;
    try {
      syncStatus = await adapter.getSyncStatus();
    } catch (error) {
      syncStatus = {
        ...syncStatus,
        state: "error",
        lastError: getErrorMessage(error, "Unable to read sync status."),
      };
    } finally {
      syncStatusRequestInFlight = false;
    }
  };

  const stopSyncStatusPolling = (): void => {
    if (syncStatusPoller !== null) {
      clearInterval(syncStatusPoller);
      syncStatusPoller = null;
    }
  };

  const ensureSyncStatusPolling = (): void => {
    if (typeof window === "undefined") {
      return;
    }
    if (activeStorageMode !== "s3") {
      stopSyncStatusPolling();
      syncStatus = createDefaultSyncStatus();
      return;
    }
    if (syncStatusPoller !== null) {
      return;
    }
    void refreshSyncStatus();
    syncStatusPoller = window.setInterval(() => {
      void refreshSyncStatus();
    }, 2500);
  };

  const retrySyncNow = async (): Promise<void> => {
    if (activeStorageMode !== "s3") {
      return;
    }
    try {
      await adapter.flushPendingSync();
      await refreshSyncStatus();
      pushToast("Sync retry started.", { tone: "success" });
    } catch (error) {
      const message = getErrorMessage(error, "Sync retry failed.");
      syncStatus = {
        ...syncStatus,
        state: "error",
        lastError: message,
      };
      pushToast(message, { tone: "error" });
    }
  };

  const createNoteDocument = (): NoteDocumentFile => {
    const timestamp = Date.now();
    const resolvedFolderId =
      preferences.newNoteLocation === "all-notes" ? null : activeFolderId;
    return {
      id: createUlid(),
      title: "",
      createdAt: timestamp,
      updatedAt: timestamp,
      folderId: resolvedFolderId,
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

  const ensureVaultForAdapter = async (
    activeAdapter: StorageAdapter
  ): Promise<Vault | null> => {
    const existing = await runAdapterTask(() => activeAdapter.readVault(), null);
    if (existing) {
      return existing;
    }
    const vault = createDefaultVault();
    const stored = await runAdapterVoid(() => activeAdapter.writeVault(vault));
    return stored ? vault : null;
  };

  const ensureVaultForAdapterStrict = async (
    activeAdapter: StorageAdapter
  ): Promise<Vault> => {
    const existing = await activeAdapter.readVault();
    if (existing) {
      return existing;
    }
    const vault = createDefaultVault();
    await activeAdapter.writeVault(vault);
    return vault;
  };

  const runS3StartupWithRetries = async (
    operation: (attempt: number) => Promise<void>
  ): Promise<void> => {
    resetStartupState();
    setStartupState({
      blocking: true,
      stage: "s3_connecting",
      maxAttempts: s3StartupMaxAttempts,
    });
    let latestError: unknown = null;
    for (
      let attempt = 1;
      attempt <= s3StartupMaxAttempts;
      attempt += 1
    ) {
      try {
        setStartupState({
          stage: "s3_connecting",
          attempt,
          error: null,
          blocking: true,
        });
        await operation(attempt);
        return;
      } catch (error) {
        latestError = error;
        setStartupState({
          stage: "failed",
          attempt,
          blocking: true,
          error: getErrorMessage(error, "Failed to connect to S3."),
        });
        if (attempt < s3StartupMaxAttempts) {
          const waitIndex = Math.min(attempt - 1, s3StartupBackoffMs.length - 1);
          await waitForDelay(s3StartupBackoffMs[waitIndex] ?? 0);
        }
      }
    }
    throw latestError instanceof Error
      ? latestError
      : new Error("S3 startup failed.");
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
      const ensured = await ensureVaultForAdapter(nextAdapter);
      if (!ensured) {
        return;
      }
      await persistStorageChoice("filesystem", { handle });
      await initializeWorkspace();
      stopSyncStatusPolling();
      syncStatus = createDefaultSyncStatus();
      resetStartupState();
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

  const switchToBrowserStorage = async (
    { notifyFallback = false }: { notifyFallback?: boolean } = {}
  ): Promise<void> => {
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
      const ensured = await ensureVaultForAdapter(nextAdapter);
      if (!ensured) {
        return;
      }
      await persistStorageChoice("idb");
      await initializeWorkspace();
      stopSyncStatusPolling();
      syncStatus = createDefaultSyncStatus();
      resetStartupState();
      if (notifyFallback) {
        notifyAdapterFailure(adapterFallbackToastMessage);
      }
    } finally {
      isRecoveringStorage = false;
      isLoading = false;
    }
  };

  const createS3Adapter = async (
    config: S3Config,
    options: { requestTimeoutMs?: number } = {}
  ): Promise<StorageAdapter> => {
    const module = await import("$lib/core/storage/s3.adapter");
    return new module.S3Adapter(config, {
      requestTimeoutMs: options.requestTimeoutMs,
    });
  };

  const initializeS3Startup = async (config: S3Config): Promise<boolean> => {
    s3StartupConfig = config;
    isLoading = true;
    try {
      await runS3StartupWithRetries(async (attempt) => {
        const nextAdapter = await initAdapterAsync("s3", {
          s3Config: config,
          s3RequestTimeoutMs: s3StartupRequestTimeoutMs,
        });
        setStartupState({
          stage: "vault_loading",
          attempt,
          blocking: true,
        });
        await nextAdapter.init();
        setStartupState({
          stage: "workspace_restoring",
          attempt,
          blocking: true,
        });
        await initializeWorkspace({
          skipAdapterInit: true,
          deferSearchIndex: true,
          strict: true,
        });
      });
      setStartupState({
        stage: "search_indexing_bg",
        blocking: false,
        error: null,
      });
      void loadSearchIndexInBackground();
      await refreshSyncStatus();
      return true;
    } catch (error) {
      console.warn("S3 startup failed:", error);
      isLoading = false;
      return false;
    }
  };

  const retryS3Startup = async (): Promise<void> => {
    if (!s3StartupConfig || isRecoveringStorage) {
      return;
    }
    isRecoveringStorage = true;
    try {
      await initializeS3Startup(s3StartupConfig);
    } finally {
      isRecoveringStorage = false;
    }
  };

  const goToOnboardingFromStartupFailure = async (): Promise<void> => {
    resetStartupState();
    stopSyncStatusPolling();
    syncStatus = createDefaultSyncStatus();
    isLoading = false;
    await goto(resolve("/onboarding"));
  };

  const migrateCurrentVaultToStorage = async (target: {
    mode: StorageMode;
    directoryHandle?: FileSystemDirectoryHandle;
    s3Config?: S3Config;
  }): Promise<void> => {
    if (isRecoveringStorage) {
      return;
    }
    if (!vault) {
      pushToast("Nothing to migrate yet.", { tone: "error" });
      return;
    }

    isRecoveringStorage = true;
    isLoading = true;
    const toastId = pushToast("Migrating vault...", { durationMs: 0 });
    try {
      await flushPendingSave();
      const backup = await createVaultBackup({ adapter, vault });

      const mode = target.mode;
      let stagedAdapter: StorageAdapter;
      if (mode === "filesystem") {
        if (!target.directoryHandle) {
          throw new Error("Missing directory handle for folder storage.");
        }
        stagedAdapter = new FileSystemAdapter(target.directoryHandle);
      } else if (mode === "s3") {
        if (!target.s3Config) {
          throw new Error("Missing S3 config for migration.");
        }
        stagedAdapter = await createS3Adapter(target.s3Config, {
          requestTimeoutMs: s3StartupRequestTimeoutMs,
        });
      } else {
        stagedAdapter = new IndexedDBAdapter();
      }

      await stagedAdapter.init();

      const existingTargetVault = await stagedAdapter.readVault();
      const backupToRestore = existingTargetVault
        ? mergeVaultBackups({
            base: await createVaultBackup({
              adapter: stagedAdapter,
              vault: existingTargetVault,
            }),
            incoming: backup,
          })
        : backup;

      await restoreVaultBackup({
        adapter: stagedAdapter,
        backup: backupToRestore,
      });

      const nextAdapter =
        mode === "s3"
          ? await initAdapterAsync("s3", {
              s3Config: target.s3Config,
              s3RequestTimeoutMs: s3StartupRequestTimeoutMs,
            })
          : initAdapter(mode, {
              directoryHandle: target.directoryHandle,
            });
      const ready = await runAdapterVoid(() => nextAdapter.init());
      if (!ready) {
        throw new Error("Failed to initialize migrated storage.");
      }
      await persistStorageChoice(mode, {
        handle: target.directoryHandle,
        s3: target.s3Config,
      });
      await initializeWorkspace();
      if (mode === "s3") {
        await refreshSyncStatus();
      } else {
        stopSyncStatusPolling();
        syncStatus = createDefaultSyncStatus();
        resetStartupState();
      }

      dismissToast(toastId);
      pushToast("Migration complete.", { tone: "success" });
    } catch (error) {
      dismissToast(toastId);
      const reason =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Please retry.";
      pushToast(`Migration failed: ${reason}`, { tone: "error" });
    } finally {
      isRecoveringStorage = false;
      isLoading = false;
    }
  };

  const migrateToFolderStorage = async (): Promise<void> => {
    if (typeof window === "undefined") {
      return;
    }
    if (typeof window.showDirectoryPicker !== "function") {
      pushToast("Folder storage requires a Chromium browser (Chrome/Edge).", {
        tone: "error",
      });
      return;
    }
    const handle = await window.showDirectoryPicker();
    await migrateCurrentVaultToStorage({ mode: "filesystem", directoryHandle: handle });
  };

  const migrateToBrowserStorage = async (): Promise<void> => {
    await migrateCurrentVaultToStorage({ mode: "idb" });
  };

  const migrateToS3Storage = async (config: S3Config): Promise<void> => {
    await migrateCurrentVaultToStorage({ mode: "s3", s3Config: config });
  };

  const switchToS3Storage = async (config: S3Config): Promise<void> => {
    if (isRecoveringStorage) {
      return;
    }
    isRecoveringStorage = true;
    isLoading = true;
    try {
      const nextAdapter = await initAdapterAsync("s3", {
        s3Config: config,
        s3RequestTimeoutMs: s3StartupRequestTimeoutMs,
      });
      const ready = await runAdapterVoid(() => nextAdapter.init());
      if (!ready) {
        return;
      }
      const ensured = await ensureVaultForAdapter(nextAdapter);
      if (!ensured) {
        return;
      }
      await persistStorageChoice("s3", { s3: config });
      await initializeWorkspace();
      await refreshSyncStatus();
      resetStartupState();
      pushToast("Connected to S3.", { tone: "success" });
    } catch (error) {
      const handled = await handleAdapterError(error);
      if (!handled) {
        handleNonBlockingAdapterError(error);
      }
    } finally {
      isRecoveringStorage = false;
      isLoading = false;
    }
  };

  const requestFolderSwitch = (): void => {
    if (isRecoveringStorage || !supportsFileSystemAccess()) {
      return;
    }
    const title =
      activeStorageMode === "filesystem" ? "Change vault folder" : "Switch storage";
    const message =
      activeStorageMode === "filesystem"
        ? "Your vault will be copied into the selected folder. Existing data in that folder may be replaced. Continue?"
        : "Your current vault will be copied into the selected folder. Existing data in that folder may be replaced. Continue?";
    openModal("confirm", {
      title,
      message,
      confirmLabel: "Choose folder",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        closeSettings();
        await migrateToFolderStorage();
      },
    });
  };

  const requestBrowserStorageSwitch = (): void => {
    if (isRecoveringStorage || activeStorageMode === "idb") {
      return;
    }
    openModal("confirm", {
      title: "Switch to browser storage",
      message:
        "Your current vault will be copied into browser storage and replace any existing browser vault. Continue?",
      confirmLabel: "Use browser storage",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        closeSettings();
        await migrateToBrowserStorage();
      },
    });
  };

  const requestS3StorageSwitch = (config: S3Config): void => {
    if (isRecoveringStorage) {
      return;
    }
    const trimmed = normalizeS3ConfigInput(config);
    if (
      !trimmed.bucket ||
      !trimmed.region ||
      !trimmed.accessKeyId ||
      !trimmed.secretAccessKey
    ) {
      pushToast("Missing S3 config (bucket, region, access key, secret).", {
        tone: "error",
      });
      return;
    }
    const title =
      activeStorageMode === "s3" ? "Update S3 settings" : "Switch to S3 storage";
    const message =
      activeStorageMode === "s3"
        ? "Updating S3 settings will reconnect the app. Continue?"
        : "Your current vault will be copied into S3 and replace any existing vault at that prefix. Continue?";
    openModal("confirm", {
      title,
      message,
      confirmLabel: activeStorageMode === "s3" ? "Update S3" : "Connect S3",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        closeSettings();
        if (activeStorageMode === "s3") {
          await switchToS3Storage(trimmed);
          return;
        }
        await migrateToS3Storage(trimmed);
      },
    });
  };

  const handleRunIntegrityCheck = async (): Promise<VaultIntegrityReport> => {
    if (!vault) {
      const report: VaultIntegrityReport = {
        checkedAt: Date.now(),
        issues: [{ severity: "error", message: "No vault loaded." }],
      };
      pushToast("No vault loaded.", { tone: "error" });
      return report;
    }
    await flushPendingSave();
    const report = await runVaultIntegrityCheck({ adapter, vault });
    pushToast(
      report.issues.length === 0
        ? "Integrity check: no issues found."
        : `Integrity check: ${report.issues.length} issue${report.issues.length === 1 ? "" : "s"} found.`,
      { tone: report.issues.length === 0 ? "success" : "info" }
    );
    return report;
  };

  const handleRepairVault = async (report: VaultIntegrityReport): Promise<void> => {
    const vaultSnapshot = vault;
    if (!vaultSnapshot) {
      pushToast("No vault loaded.", { tone: "error" });
      return;
    }
    await flushPendingSave();
    const toastId = pushToast("Repairing vault...", { durationMs: 0 });
    try {
      await enqueueAdapterWrite(async () => {
        await applyVaultIntegrityRepairs({ adapter, vault: vaultSnapshot, report });
      });
      await initializeWorkspace();
      await rebuildSearchIndex();
      dismissToast(toastId);
      pushToast("Repairs applied.", { tone: "success" });
    } catch (error) {
      dismissToast(toastId);
      pushToast("Repair failed. Please retry.", { tone: "error" });
    }
  };

  const rebuildSearchIndex = async (): Promise<void> => {
    if (!vault) {
      return;
    }
    const noteDocuments = await loadNoteDocumentsForIndex();
    const index = buildSearchIndex(noteDocuments);
    await runAdapterVoid(() =>
      adapter.writeSearchIndex(serializeSearchIndex(index))
    );
    searchState = { index };
    pushToast("Search index rebuilt.", { tone: "success" });
  };

  const clearWorkspaceState = async (): Promise<void> => {
    const current =
      (await runAdapterTask(() => adapter.readUIState(), null)) ?? {};
    const nextState = { ...current };
    delete (nextState as { workspaceState?: unknown }).workspaceState;
    await runAdapterVoid(() => adapter.writeUIState(nextState));
    paneLayout = createLeaf("primary");
    paneStates = { primary: createPaneState() };
    activePane = "primary";
    tabTitles = {};
    setPaneNote("primary", null);
    refreshBacklinksForNote(null);
    syncSaveState();
    pushToast("Workspace layout reset.", { tone: "success" });
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
    if (!vault) {
      return null;
    }
    const assetId = await hashBlobSha256(file);
    const meta = await readImageMeta(file);
    await runAdapterVoid(() =>
      adapter.writeAsset({
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

  const ensurePaneState = (paneId: PaneId): PaneState => {
    const existing = paneStates[paneId];
    if (existing) {
      return existing;
    }
    const created = createPaneState();
    paneStates = { ...paneStates, [paneId]: created };
    return created;
  };

  const getPaneState = (paneId: PaneId): PaneState => ensurePaneState(paneId);

  const ensureTabViewMode = (
    pane: PaneState,
    noteId: string
  ): Record<string, "editor" | "markdown"> => {
    const current = pane.tabViewModes[noteId];
    if (current) {
      return pane.tabViewModes;
    }
    return { ...pane.tabViewModes, [noteId]: defaultTabViewMode() };
  };

  const pruneTabViewModes = (
    tabIds: string[],
    viewModes: Record<string, "editor" | "markdown">
  ): Record<string, "editor" | "markdown"> => {
    if (tabIds.length === 0) {
      return {};
    }
    const set = new Set(tabIds);
    return Object.fromEntries(
      Object.entries(viewModes).filter(([noteId]) => set.has(noteId))
    ) as Record<string, "editor" | "markdown">;
  };

  const buildDefaultTabViewModes = (
    tabIds: string[]
  ): Record<string, "editor" | "markdown"> =>
    Object.fromEntries(
      tabIds.map((noteId) => [noteId, defaultTabViewMode()])
    ) as Record<string, "editor" | "markdown">;

  const updatePaneState = (
    paneId: PaneId,
    updates: Partial<PaneState>
  ): void => {
    const current = ensurePaneState(paneId);
    paneStates = {
      ...paneStates,
      [paneId]: {
        ...current,
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
    const hasActiveNotes = Object.values(paneStates).some(
      (pane) => pane.note !== null
    );
    saveState = hasActiveNotes ? "saved" : "idle";
  };

  const setActivePane = (paneId: PaneId): void => {
    activePane = "primary";
    scheduleUiStateWrite();
  };

  const setPaneNote = (paneId: PaneId, note: NoteDocumentFile | null): void => {
    const resolvedDoc = note?.pmDoc ?? createEmptyDocument();
    const editorContent = note
      ? ensureTitleHeadingInPmDocument({
          pmDocument: resolvedDoc,
          title: note.title ?? "",
        })
      : createEmptyDocument();
    updatePaneState(paneId, {
      note,
      titleValue: note?.title ?? "",
      editorContent,
      editorPlainText: note?.derived?.plainText ?? "",
    });
    syncSaveState();
  };

  const buildWorkspaceUiState = (): UIState => ({
    workspaceState: {
      focusedPane: activePane,
      paneLayout,
      panes: Object.fromEntries(
        Object.entries(paneStates).map(([paneId, pane]) => [
          paneId,
          {
            tabs: pane.tabs,
            activeTabId: pane.activeTabId,
          },
        ])
      ),
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
    mobileRightPanelOpen = false;
  };

  const openGlobalSearch = (): void => {
    if (!searchState && !searchIndexBackgroundTask) {
      void loadSearchIndexInBackground();
    }
    openModal("global-search");
  };

  const openCommandPalette = (): void => {
    openModal("command-palette");
  };

  const openSettings = (): void => {
    if (settingsModalId) {
      return;
    }
    settingsModalId = openModal("settings");
  };

  const closeSettings = (): void => {
    if (!settingsModalId) {
      return;
    }
    closeModal(settingsModalId);
    settingsModalId = null;
  };

  const openHelp = (): void => {
    if (helpModalId) {
      return;
    }
    helpModalId = openModal("help");
  };

  const closeHelp = (): void => {
    if (!helpModalId) {
      return;
    }
    closeModal(helpModalId);
    helpModalId = null;
  };

  const updatePreferences = async (
    patch: Partial<AppPreferences>
  ): Promise<void> => {
    const nextPreferences = resolvePreferences({
      ...preferences,
      ...patch,
    });
    const nextStorageMode = appSettings?.storageMode ?? activeStorageMode;
    const nextSettings: AppSettings = {
      storageMode: nextStorageMode,
      fsHandle: appSettings?.fsHandle,
      lastVaultName: appSettings?.lastVaultName,
      s3: nextStorageMode === "s3" ? appSettings?.s3 : undefined,
      settings: nextPreferences,
    };
    await writeAppSettings(nextSettings);
    appSettings = nextSettings;
    preferences = nextPreferences;
  };

  const resetPreferences = async (): Promise<void> => {
    openModal("confirm", {
      title: "Reset preferences?",
      message: "Restore default settings for General and Editor.",
      confirmLabel: "Reset",
      cancelLabel: "Cancel",
      destructive: true,
      onConfirm: async () => {
        await updatePreferences(defaultPreferences);
        pushToast("Preferences reset.", { tone: "success" });
      },
    });
  };

  const openNotesView = (): void => {
    workspaceMode = "notes";
    mobileView = "notes";
    mobileRightPanelOpen = false;
    if (isMobileViewport) {
      projectsOverlayOpen = false;
    }
  };

  const openProjectsView = (): void => {
    workspaceMode = "notes";
    mobileView = "notes";
    mobileRightPanelOpen = false;
    projectsOverlayOpen = true;
  };

  const openNoteFromList = async (noteId: string): Promise<void> => {
    if (!noteId) {
      return;
    }
    if (preferences.openNoteBehavior !== "reuse-tab") {
      await activateTab(noteId);
      if (isMobileViewport) {
        mobileView = "editor";
      }
      return;
    }
    openNotesView();
    const pane = getPaneState(activePane);
    if (pane.activeTabId === noteId) {
      await loadNote(noteId, activePane);
      if (isMobileViewport) {
        mobileView = "editor";
      }
      return;
    }
    if (pane.tabs.includes(noteId)) {
      await activateTab(noteId, activePane);
      if (isMobileViewport) {
        mobileView = "editor";
      }
      return;
    }
    await flushPendingSaveForNote(pane.activeTabId);
    const nextTabs =
      pane.activeTabId && pane.tabs.length > 0
        ? pane.tabs.map((id) => (id === pane.activeTabId ? noteId : id))
        : [noteId];
    const nextTabViewModes = pruneTabViewModes(
      nextTabs,
      ensureTabViewMode(pane, noteId)
    );
    updatePaneState(activePane, {
      tabs: nextTabs,
      activeTabId: noteId,
      tabViewModes: nextTabViewModes,
    });
    scheduleUiStateWrite();
    await loadNote(noteId, activePane);
    if (isMobileViewport) {
      mobileView = "editor";
    }
  };

  const openAllNotesView = (): void => {
    openNotesView();
    ({ activeFolderId, favoritesOnly } = openAllNotesViewFilters({
      activeFolderId,
      favoritesOnly,
    }));
  };

  const toggleFavoritesFilter = (): void => {
    const next = !favoritesOnly;
    favoritesOnly = next;
  };

  const openTrashView = (): void => {
    openModal("trash");
  };

  const updateProjectsOverlayLeft = (): void => {
    if (!noteListElement) {
      return;
    }
    projectsOverlayLeft = noteListElement.getBoundingClientRect().right;
  };

  const updateViewportState = (): void => {
    if (typeof window === "undefined") {
      return;
    }
    viewportWidth = window.innerWidth;
    isMobileViewport = viewportWidth <= mobileBreakpoint;
    isRightPanelOverlayViewport = viewportWidth <= rightPanelOverlayBreakpoint;
    if (!isRightPanelOverlayViewport) {
      mobileRightPanelOpen = false;
    }
    const visualViewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const inset = Math.round(window.innerHeight - visualViewportHeight);
    mobileKeyboardInset = Math.max(0, inset);
  };

  const toggleProjectsOverlay = (): void => {
    projectsOverlayOpen = !projectsOverlayOpen;
  };

  const closeProjectsOverlay = (): void => {
    projectsOverlayOpen = false;
  };

  const openTrashFromProjects = (): void => {
    closeProjectsOverlay();
    openTrashView();
  };

  const selectAllNotesFromProjects = (): void => {
    closeProjectsOverlay();
    openAllNotesView();
  };

  const selectFolderFromProjects = (folderId: string): void => {
    closeProjectsOverlay();
    selectFolder(folderId);
  };

  const handleRightPanelTabSelect = (tab: RightPanelTab): void => {
    rightPanelTab = tab;
    refreshBacklinksForNote(tab === "metadata" ? activeNote : null);
    if (isRightPanelOverlayViewport) {
      mobileRightPanelOpen = true;
    }
  };

  const closeRightPanelOverlay = (): void => {
    mobileRightPanelOpen = false;
  };

  const sortNotes = (list: NoteIndexEntry[]): NoteIndexEntry[] => {
    const sorted = [...list];
    if (preferences.defaultSort === "created") {
      return sorted.sort((first, second) => second.createdAt - first.createdAt);
    }
    if (preferences.defaultSort === "title") {
      return sorted.sort((first, second) => {
        const firstTitle = (first.title ?? "").trim().toLowerCase();
        const secondTitle = (second.title ?? "").trim().toLowerCase();
        if (firstTitle !== secondTitle) {
          return firstTitle.localeCompare(secondTitle);
        }
        return second.updatedAt - first.updatedAt;
      });
    }
    return sorted.sort((first, second) => second.updatedAt - first.updatedAt);
  };

  const sortTrashNotes = (list: NoteIndexEntry[]): NoteIndexEntry[] =>
    [...list].sort(
      (first, second) => (second.deletedAt ?? 0) - (first.deletedAt ?? 0)
    );

  $: if (preferences.defaultSort !== lastSortMode) {
    notes = sortNotes(notes);
    lastSortMode = preferences.defaultSort;
  }

  $: activeFolderName =
    activeFolderId && vault
      ? vault.folders[activeFolderId]?.name ?? null
      : null;
  $: activeNotes = notes.filter((note) => note.deletedAt === null);
  $: displayNotes = vault
    ? orderNotesForFolder(activeNotes, activeFolderId, vault.folders)
    : [];
  $: trashedNotes = sortTrashNotes(
    notes.filter((note) => note.deletedAt !== null)
  );
  $: filteredNotes = filterNotesByFavorites(displayNotes, favoritesOnly);
  $: noteListTitle = resolveNoteListTitle(activeFolderName);
  $: noteListCount = filteredNotes.length;
  $: noteListEmptyMessage = favoritesOnly ? "No favorites yet." : "No notes yet.";

  const loadNotes = async (
    options: { strict?: boolean } = {}
  ): Promise<void> => {
    const strict = options.strict === true;
    const loadedNotes = sortNotes(
      strict
        ? await adapter.listNotes()
        : await runAdapterTask(() => adapter.listNotes(), [])
    );
    if (Object.keys(favoriteOverrides).length > 0) {
      notes = loadedNotes.map((note) => {
        const override = favoriteOverrides[note.id];
        return override === undefined ? note : { ...note, favorite: override };
      });
    } else {
      notes = loadedNotes;
    }
    const storedVault = strict
      ? await adapter.readVault()
      : await runAdapterTask(() => adapter.readVault(), null);
    if (storedVault) {
      vault = storedVault;
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
      paneLayout = createLeaf("primary");
      paneStates = { primary: createPaneState() };
      setPaneNote("primary", null);
      activePane = "primary";
      syncSaveState();
      return;
    }

    if (preferences.startupView === "all-notes") {
      paneLayout = createLeaf("primary");
      paneStates = { primary: createPaneState() };
      setPaneNote("primary", null);
      activePane = "primary";
      activeFolderId = null;
      favoritesOnly = false;
      openNotesView();
      syncSaveState();
      return;
    }

    const storedState = readWorkspaceState(
      await runAdapterTask(() => adapter.readUIState(), null)
    );
    const useStoredState = Object.keys(storedState).length > 0;

    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === "object" && value !== null;

    const fallbackNoteId = availableIds[0] ?? null;

    const mergeTabs = (lists: string[][]): string[] => {
      const merged: string[] = [];
      for (const list of lists) {
        for (const id of list) {
          if (!merged.includes(id)) {
            merged.push(id);
          }
        }
      }
      return merged;
    };

    if (useStoredState) {
      const storedPanesRaw = storedState.panes;
      const focusedPane =
        typeof storedState.focusedPane === "string" ? storedState.focusedPane : null;

      if (isRecord(storedPanesRaw)) {
        const paneEntries = Object.entries(storedPanesRaw).filter(
          ([, value]) => isRecord(value)
        ) as Array<[string, Record<string, unknown>]>;

        const focusedEntryIndex =
          focusedPane ? paneEntries.findIndex(([id]) => id === focusedPane) : -1;
        const orderedEntries =
          focusedEntryIndex >= 0
            ? [
                paneEntries[focusedEntryIndex],
                ...paneEntries.filter((_, index) => index !== focusedEntryIndex),
              ]
            : paneEntries;

        const tabsByPane: string[][] = [];
        let resolvedActive: string | null = null;

        for (const [, paneRaw] of orderedEntries) {
          let tabs = filterTabIds(paneRaw.tabs, availableIds);
          const active = resolveActiveTabId(paneRaw.activeTabId, availableIds, tabs);
          if (active && !tabs.includes(active)) {
            tabs = addTab(tabs, active);
          }
          tabsByPane.push(tabs);
          if (!resolvedActive && active) {
            resolvedActive = active;
          }
        }

        const mergedTabs = mergeTabs(tabsByPane);
        const activeTabId = resolvedActive ?? fallbackNoteId;
        paneLayout = createLeaf("primary");
        paneStates = {
          primary: {
            ...createPaneState(),
            tabs: activeTabId ? addTab(mergedTabs, activeTabId) : mergedTabs,
            activeTabId: activeTabId ?? mergedTabs[0] ?? null,
            tabViewModes: buildDefaultTabViewModes(
              activeTabId ? addTab(mergedTabs, activeTabId) : mergedTabs
            ),
          },
        };
        activePane = "primary";
      } else {
        // Migrate legacy primary/secondary split state by merging everything into primary.
        const primaryTabs = filterTabIds(storedState.tabsPrimary, availableIds);
        const secondaryTabs = filterTabIds(storedState.tabsSecondary, availableIds);
        const mergedTabs = mergeTabs([primaryTabs, secondaryTabs]);
        const primaryActive = resolveActiveTabId(
          storedState.activeTabPrimary,
          availableIds,
          primaryTabs
        );
        const secondaryActive = resolveActiveTabId(
          storedState.activeTabSecondary,
          availableIds,
          secondaryTabs
        );
        const activeTabId = primaryActive ?? secondaryActive ?? fallbackNoteId;
        paneLayout = createLeaf("primary");
        paneStates = {
          primary: {
            ...createPaneState(),
            tabs: activeTabId ? addTab(mergedTabs, activeTabId) : mergedTabs,
            activeTabId: activeTabId ?? mergedTabs[0] ?? null,
            tabViewModes: buildDefaultTabViewModes(
              activeTabId ? addTab(mergedTabs, activeTabId) : mergedTabs
            ),
          },
        };
        activePane = "primary";
      }
    } else if (fallbackNoteId) {
      paneLayout = createLeaf("primary");
      paneStates = {
        primary: {
          ...createPaneState(),
          tabs: [fallbackNoteId],
          activeTabId: fallbackNoteId,
          tabViewModes: buildDefaultTabViewModes([fallbackNoteId]),
        },
      };
      activePane = "primary";
    } else {
      paneLayout = createLeaf("primary");
      paneStates = { primary: createPaneState() };
      activePane = "primary";
    }

    const active = paneStates.primary?.activeTabId ?? null;
    if (active) {
      await loadNote(active, "primary");
    } else {
      setPaneNote("primary", null);
    }

    syncSaveState();
  };

  const loadNoteDocumentsForIndex = async (): Promise<NoteDocumentFile[]> => {
    if (!vault || notes.length === 0) {
      return [];
    }
    const noteDocuments = await Promise.all(
      notes.map(async (entry) =>
        runAdapterTask(() => adapter.readNote(entry.id), null)
      )
    );
    return noteDocuments.filter(
      (note): note is NoteDocumentFile =>
        note !== null && note.deletedAt === null
    );
  };

  const loadSearchIndex = async (): Promise<void> => {
    if (!vault) {
      searchState = null;
      searchIndexReady = false;
      searchIndexLoading = false;
      return;
    }
    searchIndexLoading = true;
    try {
      const snapshot = await runAdapterTask(() => adapter.readSearchIndex(), null);
      if (snapshot) {
        searchState = { index: loadMiniSearchIndex(snapshot) };
        searchIndexReady = true;
        return;
      }
      const noteDocuments = await loadNoteDocumentsForIndex();
      const index = buildSearchIndex(noteDocuments);
      searchState = { index };
      searchIndexReady = true;
      await runAdapterVoid(() =>
        adapter.writeSearchIndex(serializeSearchIndex(index))
      );
    } finally {
      searchIndexLoading = false;
    }
  };

  const loadSearchIndexInBackground = async (): Promise<void> => {
    if (searchIndexBackgroundTask) {
      await searchIndexBackgroundTask;
      return;
    }
    if (startupState.stage !== "failed") {
      setStartupState({
        stage: "search_indexing_bg",
        blocking: false,
      });
    }
    const task = (async () => {
      try {
        await loadSearchIndex();
      } finally {
        searchIndexBackgroundTask = null;
        if (startupState.stage === "search_indexing_bg") {
          setStartupState({
            stage: "ready",
            blocking: false,
          });
        }
      }
    })();
    searchIndexBackgroundTask = task;
    await task;
  };

  const updateSearchIndexForDocument = async (
    document: NoteDocumentFile
  ): Promise<void> => {
    if (!vault) {
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
          state: currentSearchState,
          change: {
            type: "upsert",
            note: document,
          },
        }),
      currentSearchState
    );
  };

  const persistVault = async (nextVault: Vault): Promise<void> => {
    vault = nextVault;
    await enqueueAdapterWrite(async () => {
      await runAdapterVoid(() => adapter.writeVault(nextVault));
    });
  };

  const loadNote = async (
    noteId: string,
    paneId: PaneId
  ): Promise<void> => {
    const note = await runAdapterTask(
      () => adapter.readNote(noteId),
      null
    );
    if (note) {
      setPaneNote(paneId, note);
      tabTitles = { ...tabTitles, [note.id]: note.title ?? "" };
      if (paneId === activePane) {
        refreshBacklinksForNote(note);
      }
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
    const nextTabViewModes = ensureTabViewMode(pane, noteId);
    updatePaneState(paneId, {
      tabs: nextTabs,
      activeTabId: noteId,
      tabViewModes: nextTabViewModes,
    });
    scheduleUiStateWrite();
    await loadNote(noteId, paneId);
  };

  const handleCloseTab = async (
    noteId: string,
    paneId: PaneId = "primary"
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
      tabViewModes: pruneTabViewModes(nextState.tabs, pane.tabViewModes),
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
    if (paneId === activePane) {
      refreshBacklinksForNote(null);
    }
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

  const toggleMarkdownViewForPane = (paneId: PaneId): void => {
    const pane = getPaneState(paneId);
    const noteId = pane.activeTabId;
    if (!noteId) {
      return;
    }
    const current = pane.tabViewModes[noteId] ?? "editor";
    const next: "editor" | "markdown" =
      current === "markdown" ? "editor" : "markdown";
    updatePaneState(paneId, {
      tabViewModes: { ...pane.tabViewModes, [noteId]: next },
    });
  };

  const handlePaneKeydown = (
    event: KeyboardEvent,
    paneId: PaneId
  ): void => {
    // Only treat Enter/Space as a "select pane" action when the pane container
    // itself is focused. Otherwise we'd break typing (e.g. spaces) inside the editor.
    if (event.target !== event.currentTarget) {
      return;
    }
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
    dropTargetTabId = null;
  };

  const resolveNoteDocument = async (
    noteId: string
  ): Promise<NoteDocumentFile | null> => {
    for (const pane of Object.values(paneStates)) {
      if (pane.note?.id === noteId) {
        return pane.note;
      }
    }
    return runAdapterTask(() => adapter.readNote(noteId), null);
  };

  const syncPaneNoteFolder = (
    noteId: string,
    note: NoteDocumentFile
  ): void => {
    for (const [paneId, pane] of Object.entries(paneStates)) {
      if (pane.note?.id !== noteId) {
        continue;
      }
      updatePaneState(paneId, {
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
    if (!vault || !activeFolderId) {
      return;
    }
    const currentOrder = resolveFolderNoteOrder(
      notes,
      activeFolderId,
      vault.folders
    );
    const nextOrder = reorderNoteIds(currentOrder, fromId, toId);
    if (nextOrder === currentOrder) {
      return;
    }
    const nextFolders = setFolderNoteOrder(
      vault.folders,
      activeFolderId,
      nextOrder
    );
    const updatedVault: Vault = {
      ...vault,
      folders: nextFolders,
      updatedAt: Date.now(),
    };
    await persistVault(updatedVault);
  };

  const moveNoteToFolder = async (
    noteId: string,
    targetFolderId: string
  ): Promise<void> => {
    if (!vault) {
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
      sourceFolderId && vault
        ? resolveFolderNoteOrder(notes, sourceFolderId, vault.folders)
        : [];
    const targetOrder = resolveFolderNoteOrder(
      notes,
      targetFolderId,
      vault.folders
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

    const storedVault = await runAdapterTask(
      () => adapter.readVault(),
      null
    );
    if (!storedVault) {
      return;
    }
    let nextFolders = storedVault.folders;
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
    const updatedVault: Vault = {
      ...storedVault,
      folders: nextFolders,
      updatedAt: Date.now(),
    };
    await persistVault(updatedVault);
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

  // Split view and pane docking have been removed; the editor always renders a
  // single pane.

	  const persistNote = async (note: NoteDocumentFile): Promise<void> => {
	    if (!vault) {
	      return;
	    }
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

    await enqueueAdapterWrite(async () => {
      await runAdapterVoid(() =>
        adapter.writeNote({
          noteId: note.id,
          noteDocument: resolvedNote,
          derivedMarkdown: toDerivedMarkdown(note.title, resolvedPlainText),
        })
      );
	    });

	    await updateSearchIndexForDocument(resolvedNote);

	    // Keep the in-memory pane note in sync so the metadata panel sees the
	    // latest derived fields (e.g. outgoing links) without requiring a reload.
	    for (const [paneId, pane] of Object.entries(paneStates)) {
	      if (pane.note?.id !== resolvedNote.id) {
	        continue;
	      }
	      updatePaneState(paneId, {
	        note: resolvedNote,
	      });
	    }
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
        if (noteSnapshot.id in titleOverrides) {
          const { [noteSnapshot.id]: _cleared, ...rest } = titleOverrides;
          titleOverrides = rest;
        }
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
    if (resolvedTitle) {
      if (titleOverrides[updatedNote.id] !== resolvedTitle) {
        titleOverrides = { ...titleOverrides, [updatedNote.id]: resolvedTitle };
      }
    } else if (updatedNote.id in titleOverrides) {
      const { [updatedNote.id]: _removed, ...rest } = titleOverrides;
      titleOverrides = rest;
    }
    scheduleSave(updatedNote);
  };

  const removeNoteFromTabs = async (noteId: string): Promise<void> => {
    const paneId = "primary";
    const pane = getPaneState(paneId);
    if (pane.tabs.includes(noteId)) {
      const wasActive = pane.activeTabId === noteId;
      const nextState = closeTabState(
        { tabs: pane.tabs, activeTabId: pane.activeTabId },
        noteId
      );
      updatePaneState(paneId, {
        ...nextState,
        tabViewModes: pruneTabViewModes(nextState.tabs, pane.tabViewModes),
      });
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
    if (!vault || !Object.hasOwn(vault.notesIndex, noteId)) {
      return;
    }
    const { [noteId]: _removed, ...remainingNotes } = vault.notesIndex;
    const updatedVault: Vault = {
      ...vault,
      notesIndex: remainingNotes,
      updatedAt: Math.max(vault.updatedAt, Date.now()),
    };
    vault = updatedVault;
  };

  const deleteNoteToTrash = async (noteId: string): Promise<void> => {
    if (!vault) {
      return;
    }
    await flushPendingSaveForNote(noteId);
    await removeNoteFromTabs(noteId);
    await runAdapterVoid(() => adapter.deleteNoteSoft(noteId));
    const updatedNote = await runAdapterTask(
      () => adapter.readNote(noteId),
      null
    );
    if (updatedNote) {
      await updateSearchIndexForDocument(updatedNote);
    }
    await loadNotes();
  };

  const restoreTrashedNote = async (noteId: string): Promise<void> => {
    if (!vault) {
      return;
    }
    await runAdapterVoid(() => adapter.restoreNote(noteId));
    const restoredNote = await runAdapterTask(
      () => adapter.readNote(noteId),
      null
    );
    if (restoredNote) {
      await updateSearchIndexForDocument(restoredNote);
    }
    await loadNotes();
  };

  const deleteNotePermanently = async (noteId: string): Promise<void> => {
    if (!vault) {
      return;
    }
    removeNoteFromLocalState(noteId);
    await flushPendingSaveForNote(noteId);
    await removeNoteFromTabs(noteId);
    await runAdapterVoid(() => adapter.deleteNotePermanent(noteId));
    if (!searchState) {
      await loadSearchIndex();
    }
    const currentSearchState = searchState;
    if (currentSearchState) {
      searchState = await runAdapterTask(
        () =>
          applySearchIndexChange({
            adapter,
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
    const noteId = pane.note.id;
    if (!preferences.confirmTrash) {
      void deleteNoteToTrash(noteId);
      return;
    }
    const title = pane.note.title?.trim() || "Untitled";
    openModal("confirm", {
      title: "Move note to Trash?",
      message: `Move "${title}" to Trash? You can restore it later.`,
      confirmLabel: "Move to Trash",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        await deleteNoteToTrash(noteId);
      },
    });
  };

  const updateCustomFieldsForNote = (
    noteId: string,
    fields: Record<string, CustomFieldValue>
  ): void => {
    const timestamp = Date.now();
    let updatedNote: NoteDocumentFile | null = null;
    Object.entries(paneStates).forEach(([paneId, pane]) => {
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
    Object.entries(paneStates).forEach(([paneId, pane]) => {
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
    for (const pane of Object.values(paneStates)) {
      if (pane.note?.id === noteId) {
        return { ...pane.note, favorite };
      }
    }
    const note = await runAdapterTask(
      () => adapter.readNote(noteId),
      null
    );
    return note ? { ...note, favorite } : null;
  };

  const setNoteFavorite = async (
    noteId: string,
    favorite: boolean
  ): Promise<void> => {
    if (!vault) {
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
    const titleValue = extractTitleFromPmDocument(payload.json);
    const { body } = splitEditorTextIntoTitleAndBody(payload.text);
    applyEdits(paneId, {
      pmDoc: payload.json,
      plainText: body,
      title: titleValue,
    });
  };

  const createNote = async (): Promise<void> => {
    if (!vault) {
      return;
    }
    favoritesOnly = false;
    void flushPendingSave();
    openNotesView();
    const note = createNoteDocument();
    setPaneNote(activePane, note);
    const pane = getPaneState(activePane);
    const nextTabViewModes = ensureTabViewMode(pane, note.id);
    updatePaneState(activePane, {
      tabs: addTab(pane.tabs, note.id),
      activeTabId: note.id,
      tabViewModes: nextTabViewModes,
    });
    tabTitles = { ...tabTitles, [note.id]: note.title ?? "" };
    saveState = "saving";
    scheduleUiStateWrite();
    const latestSnapshot =
      Object.values(paneStates).find((entry) => entry.note?.id === note.id)
        ?.note ?? note;
    await persistNote(latestSnapshot);
    await loadNotes();
    if (
      activeFolderId &&
      note.folderId === activeFolderId &&
      vault?.folders[activeFolderId]?.noteIds
    ) {
      const currentOrder = resolveFolderNoteOrder(
        notes,
        activeFolderId,
        vault.folders
      );
      const nextOrder = [...currentOrder.filter((id) => id !== note.id), note.id];
      const nextFolders = setFolderNoteOrder(
        vault.folders,
        activeFolderId,
        nextOrder
      );
      const updatedVault: Vault = {
        ...vault,
        folders: nextFolders,
        updatedAt: Date.now(),
      };
      await persistVault(updatedVault);
    }
    syncSaveState();
  };

  const createFolder = async (parentId: string | null): Promise<string | null> => {
    if (!vault) {
      return null;
    }
    const folderId = createUlid();
    const nextFolders = addFolder(vault.folders, {
      id: folderId,
      name: "New folder",
      parentId,
    });
    const updatedVault: Vault = {
      ...vault,
      folders: nextFolders,
      updatedAt: Date.now(),
    };
    await persistVault(updatedVault);
    return folderId;
  };

  const renameFolder = async (
    folderId: string,
    name: string
  ): Promise<void> => {
    if (!vault) {
      return;
    }
    const nextFolders = renameFolderEntry(vault.folders, folderId, name);
    if (nextFolders === vault.folders) {
      return;
    }
    const updatedVault: Vault = {
      ...vault,
      folders: nextFolders,
      updatedAt: Date.now(),
    };
    await persistVault(updatedVault);
  };

  const deleteFolder = async (folderId: string): Promise<void> => {
    if (!vault) {
      return;
    }
    if (!isFolderEmpty(folderId, vault.folders, vault.notesIndex)) {
      return;
    }
    const nextFolders = removeFolder(vault.folders, folderId);
    const updatedVault: Vault = {
      ...vault,
      folders: nextFolders,
      updatedAt: Date.now(),
    };
    await persistVault(updatedVault);
    if (activeFolderId === folderId) {
      activeFolderId = null;
    }
  };

  const selectFolder = (folderId: string): void => {
    activeFolderId = folderId;
  };

  type AppInitializationPlan = {
    ready: boolean;
    s3Config?: S3Config;
  };

  const initializeFromAppSettings = async (): Promise<AppInitializationPlan> => {
    const stored = await loadAppSettings();
    const ephemeralHandle = getEphemeralHandle();
    if (!stored?.storageMode) {
      if (ephemeralHandle && supportsFileSystemAccess()) {
        appSettings = {
          storageMode: "filesystem",
          fsHandle: ephemeralHandle,
          lastVaultName: ephemeralHandle.name,
          settings: preferences,
        };
        initAdapter("filesystem", { directoryHandle: ephemeralHandle });
        return { ready: true };
      }
      isLoading = false;
      await goto(resolve("/onboarding"));
      return { ready: false };
    }
    if (stored.storageMode === "filesystem") {
      const resolvedHandle = stored.fsHandle ?? ephemeralHandle;
      if (resolvedHandle && !stored.fsHandle) {
        appSettings = {
          ...stored,
          fsHandle: resolvedHandle,
          lastVaultName: stored.lastVaultName ?? resolvedHandle.name,
        };
      }
      if (!resolvedHandle) {
        isLoading = false;
        await goto(resolve("/onboarding"));
        return { ready: false };
      }
      if (!supportsFileSystemAccess()) {
        await persistStorageChoice("idb");
        initAdapter("idb");
        notifyAdapterFailure(adapterFallbackToastMessage);
        return { ready: true };
      }
      initAdapter("filesystem", { directoryHandle: resolvedHandle });
      return { ready: true };
    }
    if (stored.storageMode === "s3") {
      if (!stored.s3) {
        isLoading = false;
        await goto(resolve("/onboarding"));
        return { ready: false };
      }
      return { ready: true, s3Config: stored.s3 };
    }
    initAdapter("idb");
    return { ready: true };
  };

  const initializeApp = async (): Promise<void> => {
    const plan = await initializeFromAppSettings();
    if (!plan.ready) {
      return;
    }
    if (plan.s3Config) {
      await initializeS3Startup(plan.s3Config);
      return;
    }
    await initializeWorkspace();
  };

  type InitializeWorkspaceOptions = {
    skipAdapterInit?: boolean;
    deferSearchIndex?: boolean;
    strict?: boolean;
  };

  const initializeWorkspace = async (
    options: InitializeWorkspaceOptions = {}
  ): Promise<void> => {
    const strict = options.strict === true;
    const deferSearchIndex = options.deferSearchIndex === true;
    isLoading = true;
    if (!options.skipAdapterInit) {
      if (strict) {
        await adapter.init();
      } else {
        const ready = await runAdapterVoid(() => adapter.init());
        if (!ready) {
          isLoading = false;
          return;
        }
      }
    }
    const storedVault = strict
      ? await ensureVaultForAdapterStrict(adapter)
      : await ensureVaultForAdapter(adapter);
    if (!storedVault && !strict) {
      if (!permissionModalId) {
        await goto(resolve("/onboarding"));
      }
      isLoading = false;
      return;
    }
    vault = storedVault ?? vault;
    await loadNotes({ strict });
    await restoreWorkspaceState();
    activeFolderId = null;
    if (deferSearchIndex) {
      searchState = null;
      searchIndexReady = false;
      searchIndexLoading = true;
      void loadSearchIndexInBackground();
    } else {
      await loadSearchIndex();
    }
    if (activeStorageMode === "s3") {
      ensureSyncStatusPolling();
      await refreshSyncStatus();
    }
    if (startupState.stage !== "failed") {
      setStartupState({
        stage: deferSearchIndex ? "search_indexing_bg" : "ready",
        blocking: false,
        error: null,
      });
    }
    isLoading = false;
  };

  onMount(() => {
    supportsFileSystem = supportsFileSystemAccess();
    updateViewportState();
    void initializeApp();

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

    const handleWindowResize = (): void => {
      updateViewportState();
      updateProjectsOverlayLeft();
    };
    const handleVisualViewportChange = (): void => {
      updateViewportState();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleGlobalShortcut);
    window.addEventListener("resize", handleWindowResize);
    window.addEventListener("orientationchange", handleWindowResize);
    window.visualViewport?.addEventListener("resize", handleVisualViewportChange);
    window.visualViewport?.addEventListener("scroll", handleVisualViewportChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleGlobalShortcut);
      window.removeEventListener("resize", handleWindowResize);
      window.removeEventListener("orientationchange", handleWindowResize);
      window.visualViewport?.removeEventListener("resize", handleVisualViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleVisualViewportChange);
    };
  });

  onMount(() => {
    updateProjectsOverlayLeft();
    if (!noteListElement) {
      return;
    }
    const observer = new ResizeObserver(() => {
      updateProjectsOverlayLeft();
    });
    observer.observe(noteListElement);
    return () => {
      observer.disconnect();
    };
  });

  onDestroy(() => {
    adapterUnsubscribe();
    storageModeUnsubscribe();
    modalStackUnsubscribe();
    stopSyncStatusPolling();
  });

  $: {
    const hasActiveEditor = Boolean(activeNote);
    const resolvedView = resolveMobileView(mobileView, hasActiveEditor);
    if (resolvedView !== mobileView) {
      mobileView = resolvedView;
    }
  }

  $: startupStageLabel = startupStageLabels[startupState.stage];
  $: startupOverlayVisible =
    activeStorageMode === "s3" &&
    startupState.blocking &&
    (startupState.stage !== "ready" || Boolean(startupState.error));
  $: syncBadgeLabel = syncStateLabel(syncStatus.state);
  $: syncBadgeDetail =
    syncStatus.pendingCount > 0
      ? `${syncStatus.pendingCount} pending`
      : `Last sync: ${formatSyncTimestamp(syncStatus.lastSuccessAt)}`;
  $: syncInitResolutionLabel = syncInitResolutionText(syncStatus.lastInitResolution);
  $: activeStorageMode, ensureSyncStatusPolling();
</script>

<AppShell
  {saveState}
  {mobileView}
  {mobileRightPanelOpen}
  {workspaceMode}
  {mobileKeyboardInset}
  interfaceDensity={preferences.interfaceDensity}
  on:closeRightPanel={closeRightPanelOverlay}
>
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
            <X aria-hidden="true" size={14} />
          </button>
        </div>
      {/each}
    </div>
    <div class="topbar-actions">
      {#if activeStorageMode === "s3"}
        <button
          class="sync-badge"
          type="button"
          data-testid="sync-status-badge"
          data-state={syncStatus.state}
          on:click={openSettings}
        >
          <span class="sync-badge-title">{syncBadgeLabel}</span>
          <span class="sync-badge-detail">{syncBadgeDetail}</span>
        </button>
      {/if}
      <RightPanelTabs
        activeTab={rightPanelTab}
        onSelect={handleRightPanelTabSelect}
      />
      {#if isRightPanelOverlayViewport && mobileRightPanelOpen}
        <button
          class="icon-button"
          type="button"
          aria-label="Close right panel"
          data-testid="close-right-panel"
          on:click={() => {
            mobileRightPanelOpen = false;
          }}
        >
          <X aria-hidden="true" size={16} />
        </button>
      {/if}
      {#if isMobileViewport && mobileView === "editor"}
        <button
          class="button secondary topbar-back-button"
          type="button"
          aria-label="Back to list"
          data-testid="mobile-back-to-list"
          on:click={() => setMobileView("notes")}
        >
          Back to list
        </button>
      {/if}
      <button
        class="icon-button"
        type="button"
        aria-label="Open help"
        data-testid="open-help"
        on:click={openHelp}
      >
        <HelpCircle aria-hidden="true" size={18} />
      </button>
      <button
        class="icon-button settings-button"
        type="button"
        aria-label="Open settings"
        data-testid="open-settings"
        on:click={openSettings}
      >
        <Settings aria-hidden="true" size={18} />
      </button>
    </div>
  </div>

  <div slot="note-list" class="note-list-content" bind:this={noteListElement}>
    <div class="note-list-nav" aria-label="Projects navigation">
      <button
        class="projects-toggle"
        type="button"
        data-testid="projects-toggle"
        aria-pressed={projectsOverlayOpen}
        on:click={toggleProjectsOverlay}
      >
        <ChevronLeft aria-hidden="true" size={16} />
        Projects
      </button>
    </div>

    {#if isMobileViewport && projectsOverlayOpen}
      <section
        class="projects-inline"
        data-testid="projects-overlay"
        aria-label="Projects"
      >
        <header class="projects-overlay-header">
          <div class="projects-overlay-title">Projects</div>
          <button
            class="icon-button"
            type="button"
            aria-label="Close projects"
            data-testid="projects-close"
            on:click={closeProjectsOverlay}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </header>

        <button
          class="projects-all-notes"
          type="button"
          data-testid="projects-all-notes"
          on:click={selectAllNotesFromProjects}
        >
          All notes
        </button>

        <FolderTree
          folders={vault?.folders ?? {}}
          notesIndex={vault?.notesIndex ?? {}}
          {activeFolderId}
          {draggingNoteId}
          loading={isLoading}
          onSelect={selectFolderFromProjects}
          onCreate={createFolder}
          onRename={renameFolder}
          onDelete={deleteFolder}
          onOpenTrash={openTrashFromProjects}
          onNoteDrop={handleFolderNoteDrop}
        />
      </section>
    {:else}
      <header class="note-list-header">
        <div>
          <div class="note-list-title" data-testid="note-list-title">
            {noteListTitle}
          </div>
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
            <Search aria-hidden="true" size={16} />
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
      </div>

      {#if isLoading}
        <div class="note-list-empty">Loading notes...</div>
      {:else if filteredNotes.length === 0}
        <div class="note-list-empty">
          <div>{noteListEmptyMessage}</div>
          {#if favoritesOnly}
            <button
              class="button secondary"
              type="button"
              on:click={() => {
                favoritesOnly = false;
              }}
            >
              Clear filters
            </button>
          {/if}
        </div>
      {:else}
        <NoteListVirtualized
          notes={filteredNotes}
          activeNoteId={activeTabId}
          {titleOverrides}
          onSelect={noteId => void openNoteFromList(noteId)}
          onToggleFavorite={handleFavoriteToggle}
          draggable={true}
          draggingNoteId={draggingNoteId}
          dropTargetNoteId={dropTargetNoteId}
          onDragStart={handleNoteDragStart}
          onDragOver={handleNoteDragOver}
          onDrop={handleNoteDrop}
          onDragEnd={handleNoteDragEnd}
          showMeta={preferences.showNoteDates}
          showPreview={preferences.showNotePreview}
          showTags={preferences.showTagPillsInList}
          tagsById={vault?.tags ?? {}}
        />
      {/if}
    {/if}

    {#if !isMobileViewport && projectsOverlayOpen}
      <aside
        class="projects-overlay"
        data-testid="projects-overlay"
        aria-label="Projects"
        style={`left:${projectsOverlayLeft}px;`}
      >
        <header class="projects-overlay-header">
          <div class="projects-overlay-title">Projects</div>
          <button
            class="icon-button"
            type="button"
            aria-label="Close projects"
            data-testid="projects-close"
            on:click={closeProjectsOverlay}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </header>

        <button
          class="projects-all-notes"
          type="button"
          data-testid="projects-all-notes"
          on:click={selectAllNotesFromProjects}
        >
          All notes
        </button>

        <FolderTree
          folders={vault?.folders ?? {}}
          notesIndex={vault?.notesIndex ?? {}}
          {activeFolderId}
          {draggingNoteId}
          loading={isLoading}
          onSelect={selectFolderFromProjects}
          onCreate={createFolder}
          onRename={renameFolder}
          onDelete={deleteFolder}
          onOpenTrash={openTrashFromProjects}
          onNoteDrop={handleFolderNoteDrop}
        />
      </aside>
    {/if}
  </div>

  <div
    slot="editor"
    class="editor-content"
    data-pane-count="1"
  >
    <EditorPaneLayout
      node={paneLayout}
      paneStates={paneStates}
      activePaneId={activePane}
      {isLoading}
      spellcheck={preferences.spellcheck}
      smartListContinuation={preferences.smartListContinuation}
      linkCandidates={wikiLinkCandidates}
      getChips={getCustomFieldChips}
      onSetActive={setActivePane}
      onKeydown={handlePaneKeydown}
      onToggleFavorite={toggleFavoriteForPane}
      onDeleteNote={deleteNoteFromPane}
      onToggleMarkdownView={toggleMarkdownViewForPane}
      onEditorUpdate={handleEditorUpdate}
      onImagePaste={handleImagePaste}
    />
  </div>

  <RightPanel
    slot="right-panel"
    activeTab={rightPanelTab}
    activeNote={activeNote}
    {vault}
    {linkedMentions}
    {unlinkedMentions}
    {backlinksLoading}
    {unlinkedMentionsLoading}
    onOpenNote={activateTab}
    onResolveWikiLink={resolveWikiLinkInActiveNote}
    onNormalizeWikiLinks={normalizeWikiLinksInActiveNote}
    onCreateNoteForWikiLink={createNoteForWikiLink}
    onUpdateCustomFields={updateCustomFieldsForNote}
  />

  <ModalHost
    slot="modal"
    {vault}
    notes={notes}
    trashedNotes={trashedNotes}
    activeNoteId={activeTabId}
    {searchState}
    searchLoading={searchIndexLoading && !searchIndexReady}
    onOpenNote={activateTab}
    onRestoreTrashedNote={restoreTrashedNote}
    onDeleteTrashedNotePermanent={openPermanentDeleteConfirm}
    onCreateNote={createNote}
    onOpenGlobalSearch={openGlobalSearch}
    onToggleRightPanel={handleRightPanelTabSelect}
    onGoToTrash={openTrashView}
    onOpenSettings={openSettings}
    onCloseSettings={closeSettings}
    onCloseHelp={closeHelp}
    onChooseFolder={requestFolderSwitch}
    onChooseBrowserStorage={requestBrowserStorageSwitch}
    onConnectS3={requestS3StorageSwitch}
    onUpdatePreferences={updatePreferences}
    onRebuildSearchIndex={rebuildSearchIndex}
    onClearWorkspaceState={clearWorkspaceState}
    onResetPreferences={resetPreferences}
    onRetrySync={retrySyncNow}
    onRunIntegrityCheck={handleRunIntegrityCheck}
    onRepairVault={handleRepairVault}
    storageMode={activeStorageMode}
    settingsVaultName={
      appSettings?.lastVaultName ?? appSettings?.fsHandle?.name ?? null
    }
    settingsS3Bucket={appSettings?.s3?.bucket ?? null}
    settingsS3Region={appSettings?.s3?.region ?? null}
    settingsS3Prefix={appSettings?.s3?.prefix ?? null}
    settingsSyncStatus={syncStatus}
    settingsSyncStateLabel={syncBadgeLabel}
    settingsSyncLastSuccess={formatSyncTimestamp(syncStatus.lastSuccessAt)}
    settingsSyncInitResolution={syncInitResolutionLabel}
    supportsFileSystem={supportsFileSystem}
    settingsBusy={
      isRecoveringStorage ||
      isExportingVault ||
      isImportingFromFolder ||
      isBackingUpVault ||
      isRestoringBackup
    }
    {preferences}
    onExportVault={handleExportVault}
    onImportFromFolder={handleImportFromFolder}
    onDownloadBackup={handleDownloadBackup}
    onRestoreBackup={handleRestoreBackup}
  />

  <ToastHost slot="toast" />

  <svelte:fragment slot="startup-overlay">
    {#if startupOverlayVisible}
      <div class="startup-overlay" data-testid="s3-startup-overlay">
        <div class="startup-card" role="status" aria-live="polite">
          <div class="startup-title">{startupStageLabel}</div>
          <div class="startup-copy">
            Attempt {Math.max(1, startupState.attempt)} of {startupState.maxAttempts}
          </div>
          {#if startupState.stage === "search_indexing_bg"}
            <div class="startup-copy muted">
              You can start using notes while indexing completes.
            </div>
          {/if}
          {#if startupState.error}
            <div class="startup-error">{startupState.error}</div>
          {/if}
          {#if startupState.stage === "failed"}
            <div class="startup-actions">
              <button
                class="button primary"
                type="button"
                data-testid="retry-s3-startup"
                on:click={() => void retryS3Startup()}
              >
                Retry connection
              </button>
              <button
                class="button secondary"
                type="button"
                data-testid="back-to-onboarding"
                on:click={() => void goToOnboardingFromStartupFailure()}
              >
                Back to onboarding
              </button>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </svelte:fragment>

  <div slot="bottom-nav" class="mobile-nav-content">
    <button
      class="mobile-nav-button"
      class:active={workspaceMode === "notes" && mobileView === "notes"}
      type="button"
      data-testid="mobile-nav-notes"
      aria-pressed={workspaceMode === "notes" && mobileView === "notes"}
      on:click={openNotesView}
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
      data-testid="mobile-nav-projects"
      class:active={mobileView === "notes" && projectsOverlayOpen}
      aria-pressed={mobileView === "notes" && projectsOverlayOpen}
      on:click={openProjectsView}
    >
      Projects
    </button>
    <button
      class="mobile-nav-button"
      type="button"
      data-testid="mobile-nav-settings"
      aria-label="Open settings"
      on:click={openSettings}
    >
      Settings
    </button>
  </div>
</AppShell>

<style>
  .note-list-content {
    position: relative;
  }

  .note-list-nav {
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .projects-toggle {
    height: 32px;
    padding: 0 10px;
    border-radius: var(--r-sm);
    border: 1px solid var(--stroke-0);
    background: transparent;
    color: var(--text-1);
    font-size: 13px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }

  .projects-toggle:hover {
    background: var(--bg-2);
  }

  .projects-overlay {
    position: fixed;
    top: 44px;
    bottom: 0;
    width: min(320px, 86vw);
    background: var(--bg-1);
    border-left: 1px solid var(--stroke-0);
    box-shadow: var(--shadow-panel);
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 30;
  }

  .projects-overlay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .projects-overlay-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-0);
  }

  .projects-all-notes {
    height: 32px;
    padding: 0 8px;
    border-radius: var(--r-sm);
    border: none;
    background: transparent;
    color: var(--text-1);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  .projects-all-notes:hover {
    background: var(--bg-2);
  }

  .projects-inline {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    gap: 8px;
    overflow: auto;
  }

  @media (max-width: 767px) {
    .projects-overlay {
      top: 44px;
      bottom: 56px;
    }
  }

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

  .tab-close :global(svg) {
    width: 14px;
    height: 14px;
    display: block;
  }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sync-badge {
    min-width: 132px;
    max-width: 220px;
    height: 32px;
    padding: 4px 10px;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-2);
    color: var(--text-0);
    display: inline-flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 2px;
    cursor: pointer;
  }

  .sync-badge[data-state="syncing"] {
    border-color: color-mix(in srgb, var(--accent-0) 45%, var(--stroke-0));
  }

  .sync-badge[data-state="offline"],
  .sync-badge[data-state="error"] {
    border-color: color-mix(in srgb, var(--danger) 45%, var(--stroke-0));
  }

  .sync-badge-title {
    font-size: 11px;
    line-height: 1.1;
    font-weight: 600;
  }

  .sync-badge-detail {
    font-size: 10px;
    color: var(--text-2);
    line-height: 1.1;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    width: 100%;
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

  .icon-button :global(svg) {
    width: 16px;
    height: 16px;
    display: block;
  }

  .settings-button :global(svg) {
    width: 18px;
    height: 18px;
  }

  .icon-button[aria-pressed="true"] {
    background: var(--bg-2);
    color: var(--text-0);
  }

  .icon-button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
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
    flex: 1;
    flex-direction: column;
    min-height: 0;
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

  .topbar-back-button {
    height: 32px;
    white-space: nowrap;
  }

  .startup-overlay {
    position: fixed;
    inset: 0;
    z-index: 130;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(7, 9, 12, 0.55);
    backdrop-filter: blur(8px);
  }

  .startup-card {
    width: min(420px, 100%);
    border-radius: var(--r-lg);
    border: 1px solid var(--stroke-0);
    background: var(--bg-1);
    box-shadow: var(--shadow-panel);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .startup-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-0);
  }

  .startup-copy {
    font-size: 13px;
    color: var(--text-1);
  }

  .startup-copy.muted {
    color: var(--text-2);
  }

  .startup-error {
    margin-top: 4px;
    font-size: 12px;
    color: var(--danger);
    word-break: break-word;
  }

  .startup-actions {
    margin-top: 10px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  @media (max-width: 767px) {
    .sync-badge {
      min-width: 92px;
      padding: 4px 8px;
    }

    .sync-badge-detail {
      display: none;
    }

    .topbar-back-button {
      padding: 0 10px;
    }

    .startup-overlay {
      padding: 16px;
    }
  }

</style>
