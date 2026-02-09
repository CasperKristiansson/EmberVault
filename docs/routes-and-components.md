Purpose: remove ambiguity for the coding agent by defining the concrete route map, component tree, stores, and module boundaries for the SvelteKit implementation.

## 0) High-level constraints

- SvelteKit app router (file-based routes).
- No SSR required; treat as SPA, but keep SvelteKit conventions.
- All pages must be functional on mobile and desktop per ui-spec.md.
- All “modal” UI must be rendered via a single ModalHost portal to avoid layering bugs.

---

## 1) Route map (SvelteKit)

Directory: `src/routes/`

### 1.1 App entry

- `/`  
  File: `src/routes/+page.svelte`  
  Behavior:
  - If vault not configured: redirect internally to `/onboarding`
  - Else: redirect to `/app`

### 1.2 Onboarding (vault selection)

- `/onboarding`  
  Files:
  - `src/routes/onboarding/+page.svelte`
  - `src/routes/onboarding/+page.ts` (optional load) Behavior:
  - Show storage mode selection cards:
    - Folder vault (File System Access) if supported
    - Browser storage (IndexedDB) always
  - On completion:
    - Initialize adapter
    - Create default vault
    - Navigate to `/app`

### 1.3 Main workspace (single-page shell with internal state)

- `/app`  
  Files:
  - `src/routes/app/+page.svelte` Behavior:
  - Render full shell (sidebar + note list + editor + right panel)
- All internal navigation (folder/tag filters, note open, tabs, panes) is client-state driven (no subroutes required)

- `/app/[projectId]` (legacy, deprecated)  
  File:
  - `src/routes/app/[projectId]/+page.ts` Behavior:
  - Redirect to `/app` (legacy URL support)

### 1.4 URL state (query params)

Not implemented.

### 1.5 Settings (optional route; still opened as modal from workspace)

- `/settings` (optional)  
  Recommendation: do NOT use a dedicated route; implement settings as modal sheet. If a route is used:
  - `src/routes/settings/+page.svelte`
  - Must render the same SettingsPanel as modal uses.

### 1.6 Error page

- `src/routes/+error.svelte`  
  Behavior:
  - Friendly error screen, includes “Reload” button.
  - If storage permission error: link to onboarding.

---

## 2) Component tree (UI)

Directory: `src/lib/components/`

### 2.1 App shell

- `AppShell.svelte`
  - Layout wrapper used by `/app`
  - Slots or explicit children:
    - `Sidebar.svelte`
    - `NoteListPane.svelte`
    - `EditorWorkspace.svelte`
    - `RightPanel.svelte`
    - `TopBar.svelte`
    - `ModalHost.svelte`
    - `ToastHost.svelte`

### 2.2 Sidebar

- `sidebar/Sidebar.svelte`
  - `SidebarQuickActions.svelte`
  - `FolderTree.svelte`
    - `FolderTreeNode.svelte` (recursive)
  - `TagSection.svelte`
  - `SidebarFooter.svelte`

### 2.3 Note list pane

- `notes/NoteListPane.svelte`
  - `NoteListHeader.svelte`
    - Breadcrumb
    - Sort dropdown
    - Filter chips
  - `NoteListSearchRow.svelte`
  - `NoteListVirtualized.svelte`
    - `NoteListRow.svelte`
  - `EmptyState.svelte`

### 2.4 Top bar + tabs

- `topbar/TopBar.svelte`
  - `TabsBar.svelte`
    - `TabItem.svelte`
  - `TopBarActions.svelte` (right panel toggles, etc.)

### 2.5 Editor workspace

- `editor/EditorWorkspace.svelte`
  - Manages:
    - Pane docking layout (nested splits)
    - Focused pane
    - Tab routing per pane
  - Uses:
    - `EditorPane.svelte` (one pane)
      - `NoteHeader.svelte` (title + chips + favorite + menu)
      - `TiptapEditor.svelte`
        - `BlockHandleGutter.svelte`
        - `SlashMenu.svelte`
      - `EditorStatusBar.svelte` (optional: word count, saved indicator)
    - (Optional) resizable split dividers (not required)

### 2.6 Right panel

- `rightpanel/RightPanel.svelte`
  - `RightPanelTabs.svelte` (Outline / Backlinks / Metadata)
  - `OutlinePanel.svelte`
  - `BacklinksPanel.svelte`
    - `BacklinkItem.svelte`
  - `MetadataPanel.svelte`
    - `CustomFieldEditor.svelte`

### 2.7 Modals (all rendered through ModalHost)

- `modals/ModalHost.svelte`
- `modals/CommandPaletteModal.svelte`
- `modals/GlobalSearchModal.svelte`
- `modals/NoteSwitcherModal.svelte` (Cmd/Ctrl+P)
- `modals/ConfirmDialog.svelte`
- `modals/ImageLightboxModal.svelte`

### 2.8 Graph view

Removed.

### 2.9 Templates

Removed.

### 2.10 Settings

- `settings/SettingsPanel.svelte`
  - Storage mode info
  - Reduced motion toggle (if not only OS-driven)
  - Export/import actions (future)

### 2.11 Shared UI primitives

Directory: `src/lib/components/ui/`

- `Button.svelte` (primary/secondary/ghost)
- `IconButton.svelte`
- `Input.svelte`
- `Popover.svelte` (via Melt UI)
- `Dropdown.svelte`
- `Tooltip.svelte`
- `Sheet.svelte` (mobile slide-overs)
- `Divider.svelte`
- `Chip.svelte`
- `Toast.svelte`

All primitives must implement brand.md tokens and focus ring rules.

---

## 3) State management

Directory: `src/lib/state/`

### 3.1 Stores (Svelte stores)

- `adapter.store.ts`
  - `storageMode` (filesystem | idb)
  - `adapter` instance
  - `initAdapter()` + `switchAdapter()`

- `workspace.store.ts`
  - Selected folderId / tagId / view filter
  - Pane layout state:
    - `paneLayout` (tree: leaf paneId OR split row/column with children)
    - `focusedPaneId`
  - Tabs per pane:
    - `panes[paneId].tabs: noteId[]`
    - `panes[paneId].activeTabId`
  - Right panel:
    - open/closed
    - active tab (outline|backlinks|metadata)
  - UI sizes:
    - sidebarWidth, listWidth, rightPanelWidth
  - Actions:
    - openNote(noteId, targetPane)
    - closeTab(noteId, pane)
    - dockNote(noteId, targetPane, side)
    - setFocusedPane()
    - etc.

- `vault.store.ts`
  - Current vault metadata
  - Folder tree
  - Notes index (lightweight list)
  - Tags

- `notes.store.ts`
  - Note cache (Map noteId -> NoteDocFile)
  - Dirty tracking
  - Autosave scheduler
  - Soft delete/restore actions

- `assets.store.ts`
  - Asset objectURL cache (LRU)
  - readAssetUrl(assetId) => url

- `search.store.ts`
  - MiniSearch instance per vault
  - index hydration/persistence
  - query() with filters

- `ui.store.ts`
  - Modal stack (open/close)
  - Toast queue
  - Global shortcuts enable/disable (e.g., when typing in inputs)

### 3.2 Persistence of UI state

- Persist to adapter (uiState) on:
  - changes to pane widths
  - last opened view state
- last opened notes/tabs/pane layout state
  - right panel open/tab
- Debounce uiState writes: 800ms.

---

## 4) Modules (non-UI)

Directory: `src/lib/core/`

### 4.1 Storage

- `core/storage/types.ts` (StorageAdapter interface + types)
- `core/storage/indexeddb.adapter.ts`
- `core/storage/filesystem.adapter.ts`
- `core/storage/migrate.ts` (future import/export helpers)

### 4.2 Editor

- `core/editor/tiptap-config.ts`
  - single source of extensions + keymaps
- `core/editor/markdown/import.ts`
- `core/editor/markdown/export.ts`
- `core/editor/links/parse.ts` (extract outgoing links)
- `core/editor/images/paste.ts` (clipboard -> asset + node)
- `core/editor/math/katex.ts` (math node rendering)

### 4.3 Search

- `core/search/minisearch.ts`
  - buildIndex(vaultNotes)
  - updateIndex(noteChange)
  - serialize/deserialize
  - query(params)

### 4.4 Graph

Removed.

### 4.5 Shortcuts

- `core/shortcuts/map.ts` (single canonical shortcut map)
- `core/shortcuts/bindings.ts` (register/unregister, respects focus rules)

### 4.6 URL sync

- `core/url/sync.ts`
  - read URL -> apply workspace store
  - workspace store -> write URL
  - rules in Route map section 1.4
- Must prevent feedback loops:
  - use “source” flag (url|ui) to avoid double-updates

### 4.7 Utilities

- `core/utils/ulid.ts`
- `core/utils/hash.ts` (sha-256 for assets)
- `core/utils/debounce.ts`
- `core/utils/lru.ts`

---

## 5) SvelteKit file structure (concrete)

```zsh
src/
routes/
+layout.svelte
+layout.ts
+page.svelte
onboarding/
+page.svelte
app/
+page.svelte
[projectId]/
+page.ts
+error.svelte
```

```zsh
lib/
components/
AppShell.svelte
Sidebar.svelte
NoteListPane.svelte
EditorWorkspace.svelte
RightPanel.svelte
TopBar.svelte
...
components/sidebar/...
components/notes/...
components/editor/...
components/modals/...
components/settings/...
components/ui/...
```

```zsh
state/
adapter.store.ts
workspace.store.ts
vault.store.ts
notes.store.ts
assets.store.ts
search.store.ts
ui.store.ts
```

```zsh
core/
storage/...
editor/...
search/...
shortcuts/...
url/...
utils/...
```

```zsh
styles/
tokens.css
base.css
```

---

## 6) Cross-cutting behaviors (must implement consistently)

### 6.1 Modal layering

- Only ModalHost may render overlays.
- Z-index rules:
  - app chrome: 1
  - popovers/tooltips: 10
  - modal overlay: 100
  - modal panel: 110
  - toasts: 200

### 6.2 Focus management

- When modal opens: focus input (palette/search) or first focusable.
- Esc closes topmost modal and returns focus to last focused element.
- Cmd/Ctrl+K must not trigger inside editor code block if it would conflict; use central binding rules.

### 6.3 Virtualization

- `NoteListVirtualized` must be used for:
  - note list
  - search results

### 6.4 Autosave rules

- Editor changes mark note dirty immediately.
- Debounced persist 400ms.
- Immediate persist on:
  - switching active note
  - closing tab
  - blur editor
  - beforeunload (best effort)

### 6.5 Error handling

- Adapter failures surface via a blocking modal:
  - “Retry”
  - “Switch to browser storage”
- Non-blocking issues use toasts.

---

## 7) Testing mapping (component ownership)

The agent must write tests aligned with ownership:

- Storage adapters: unit tests under `src/lib/core/storage/__tests__/`
- URL sync: unit tests under `src/lib/core/url/__tests__/`
- Note list virtualization: component tests under `src/lib/components/notes/__tests__/`
- Command palette/search modals: component + e2e
- End-to-end flows: `tests/e2e/*.spec.ts` per testing.md

---

## 8) Naming conventions (avoid drift)

- “Vault” is the workspace container and storage root (folder or browser storage namespace).
- “Folder” is hierarchical; “Tag” is flat.
- “NoteDocFile” is canonical content (ProseMirror JSON + meta).
- “Derived Markdown” is secondary export format.
