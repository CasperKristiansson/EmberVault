<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/stores";
  import AppShell from "$lib/components/AppShell.svelte";
  import NoteListVirtualized from "$lib/components/notes/NoteListVirtualized.svelte";
  import FolderTree from "$lib/components/sidebar/FolderTree.svelte";
  import ProjectSwitcher from "$lib/components/sidebar/ProjectSwitcher.svelte";
  import {
    addFolder,
    isFolderEmpty,
    removeFolder,
    renameFolder as renameFolderEntry,
  } from "$lib/core/utils/folder-tree";
  import { filterNotesByFolder } from "$lib/core/utils/notes-filter";
  import { createUlid } from "$lib/core/utils/ulid";
  import {
    resolveMobileView,
    type MobileView,
  } from "$lib/core/utils/mobile-view";
  import { IndexedDBAdapter } from "$lib/core/storage/indexeddb.adapter";
  import type {
    NoteDocumentFile,
    NoteIndexEntry,
    Project,
  } from "$lib/core/storage/types";

  const adapter = new IndexedDBAdapter();

  let project: Project | null = null;
  let projects: Project[] = [];
  let notes: NoteIndexEntry[] = [];
  let activeNote: NoteDocumentFile | null = null;
  let titleValue = "";
  let bodyValue = "";
  let isLoading = true;
  let saveState: "idle" | "saving" | "saved" = "idle";
  let mobileView: MobileView = "notes";
  let activeFolderId: string | null = null;

  const saveDelay = 400;
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let saveToken = 0;

  let projectId = "";
  $: projectId = $page.params.projectId ?? "";

  const createPmDoc = (text: string): Record<string, unknown> => {
    if (text.trim().length === 0) {
      return { type: "doc", content: [] };
    }
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text }],
        },
      ],
    };
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
      title: "Untitled",
      createdAt: timestamp,
      updatedAt: timestamp,
      folderId: activeFolderId,
      tagIds: [],
      favorite: false,
      deletedAt: null,
      customFields: {},
      pmDoc: createPmDoc(""),
      derived: {
        plainText: "",
        outgoingLinks: [],
      },
    };
  };

  const setActiveNote = (note: NoteDocumentFile | null): void => {
    activeNote = note;
    titleValue = note?.title ?? "";
    bodyValue = note?.derived?.plainText ?? "";
  };

  const setMobileView = (view: MobileView): void => {
    mobileView = resolveMobileView(view, Boolean(activeNote));
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

  const persistProject = async (nextProject: Project): Promise<void> => {
    project = nextProject;
    projects = projects.some(current => current.id === nextProject.id)
      ? projects.map(current =>
          current.id === nextProject.id ? nextProject : current
        )
      : [...projects, nextProject];
    await adapter.writeProject(nextProject.id, nextProject);
  };

  const openNote = async (noteId: string): Promise<void> => {
    const note = await adapter.readNote(projectId, noteId);
    if (note) {
      setActiveNote(note);
      saveState = "saved";
    }
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
  };

  const scheduleSave = (note: NoteDocumentFile): void => {
    saveState = "saving";
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    const token = (saveToken += 1);
    const noteSnapshot = structuredClone(note);
    saveTimeout = setTimeout(async () => {
      await persistNote(noteSnapshot);
      await loadNotes();
      if (token === saveToken) {
        saveState = "saved";
      }
    }, saveDelay);
  };

  const applyEdits = (): void => {
    if (!activeNote) {
      return;
    }
    const timestamp = Date.now();
    const resolvedTitle = titleValue.trim().length > 0 ? titleValue : "Untitled";
    const updatedNote: NoteDocumentFile = {
      ...activeNote,
      title: resolvedTitle,
      updatedAt: timestamp,
      pmDoc: createPmDoc(bodyValue),
      derived: {
        plainText: bodyValue,
        outgoingLinks: activeNote.derived?.outgoingLinks ?? [],
      },
    };
    activeNote = updatedNote;
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

  const handleBodyInput = (event: Event): void => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLTextAreaElement)) {
      return;
    }
    bodyValue = target.value;
    applyEdits();
  };

  const createNote = async (): Promise<void> => {
    const note = createNoteDocument();
    setActiveNote(note);
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
      if (notes.length > 0) {
        await openNote(notes[0]?.id ?? "");
      }
      activeFolderId = null;
      isLoading = false;
    };
    void initialize();
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
    <div class="topbar-tabs">
      <button class="tab active" type="button">Untitled</button>
      <button class="tab" type="button">+</button>
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
      <button
        class="button primary"
        data-testid="new-note"
        on:click={createNote}
        disabled={isLoading}
      >
        New note
      </button>
    </header>

    {#if isLoading}
      <div class="note-list-empty">Loading notes...</div>
    {:else if displayNotes.length === 0}
      <div class="note-list-empty">No notes yet.</div>
    {:else}
      <NoteListVirtualized
        notes={displayNotes}
        activeNoteId={activeNote?.id ?? null}
        onSelect={noteId => void openNote(noteId)}
      />
    {/if}
  </div>

  <div slot="editor" class="editor-content">
    {#if isLoading}
      <div class="editor-empty">Preparing editor...</div>
    {:else if !activeNote}
      <div class="editor-empty">Select a note to start writing.</div>
    {:else}
      <label class="field">
        <span class="field-label">Title</span>
        <input
          class="field-input"
          data-testid="note-title"
          type="text"
          placeholder="Untitled"
          value={titleValue}
          on:input={handleTitleInput}
          aria-label="Note title"
        />
      </label>

      <label class="field field-body">
        <span class="field-label">Content</span>
        <textarea
          class="field-textarea"
          data-testid="note-body"
          placeholder="Start writing..."
          value={bodyValue}
          on:input={handleBodyInput}
          aria-label="Note content"
        ></textarea>
      </label>
    {/if}
  </div>

  <div slot="right-panel" class="right-panel-content">
    <div class="right-panel-title">Right panel</div>
    <div class="right-panel-subtitle">Outline · Backlinks · Metadata</div>
    <p class="right-panel-body">
      Panels will appear here as the editor grows.
    </p>
  </div>

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
  }

  .tab {
    height: 32px;
    padding: 0 12px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-1);
    cursor: pointer;
  }

  .tab.active {
    background: var(--bg-2);
    border-color: var(--stroke-0);
    color: var(--text-0);
  }

  .tab:hover {
    background: var(--bg-3);
    color: var(--text-0);
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
  .field-textarea {
    width: 100%;
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    color: var(--text-0);
    padding: 8px 12px;
  }

  .field-input:focus,
  .field-textarea:focus {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .field-textarea {
    min-height: 320px;
    resize: vertical;
    line-height: 1.55;
    font-size: 15px;
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
