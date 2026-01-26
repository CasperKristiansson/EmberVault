# Milestones (Agent Checklist)

Rule: each milestone must end with green CI (unit + e2e + typecheck + lint). No partial merges.

## Milestone 0 — Repo + tooling baseline

- [x] Initialize SvelteKit + TypeScript project (pnpm)
- [x] Configure ESLint + Prettier + strict TS
- [x] Add Vitest + Testing Library (Svelte)
- [x] Add Playwright (Chromium/Firefox/WebKit) + basic smoke test
- [ ] Add CI workflow running lint/typecheck/unit/e2e
- [ ] Add design tokens CSS file (from brand.md) and verify applied globally

## Milestone 1 — Storage foundation (IDB first)

- [ ] Implement StorageAdapter interface
- [ ] Implement IndexedDBAdapter with object stores per storage.md
- [ ] Implement Project create/read/update, default “Personal”
- [ ] Implement Note CRUD + soft delete + restore + permanent delete
- [ ] Implement Asset storage (blob) in IDB
- [ ] Unit tests for all IDB storage operations
- [ ] E2E: create/edit note, reload persists

## Milestone 2 — App shell + navigation skeleton

- [ ] Build app shell layout (sidebar, note list, editor pane, right panel)
- [ ] Implement responsive rules (desktop + mobile layout)
- [ ] Implement project switcher (single project ok for now)
- [ ] Implement folder tree (create/rename/delete empty)
- [ ] Implement note list with virtualization
- [ ] Component tests for layout focus + basic navigation
- [ ] E2E: create folder, create note in folder, list shows correct

## Milestone 3 — Block editor MVP (Tiptap)

- [ ] Integrate Tiptap editor with required extensions (checklist, table, code, link)
- [ ] Title field + autosave pipeline (debounced)
- [ ] Slash menu for block insertion
- [ ] Undo/redo wired
- [ ] Code block syntax highlighting
- [ ] Unit tests: editor doc save/load stable
- [ ] E2E: create blocks, reload preserves structure

## Milestone 4 — Images + LaTeX

- [ ] Paste image -> asset stored -> image block inserted
- [ ] Drag-drop image -> same behavior
- [ ] Image rendering with caption + lightbox modal (blur rules)
- [ ] Implement math nodes + KaTeX render (inline + block)
- [ ] Unit tests for asset dedupe + math serialize/deserialize
- [ ] E2E: paste image, reload; insert LaTeX, reload

## Milestone 5 — Search + command palette

- [ ] Implement MiniSearch index build + persistence
- [ ] Incremental indexing on note save/delete/restore
- [ ] Global search modal with filters + fuzzy
- [ ] Command palette (Cmd/Ctrl+K) with actions + note switching
- [ ] Unit tests for fuzzy search correctness
- [ ] E2E: search finds note by partial typo

## Milestone 6 — Tabs + split view + drag/drop

- [ ] Tab system in top bar (open/close/reorder)
- [ ] Split view mode with two panes
- [ ] Drag tab to other pane
- [ ] Drag notes to folders + reorder within folder (persist order)
- [ ] Component tests for tab close + split toggle
- [ ] E2E: open split, edit both, reload persists

## Milestone 7 — Backlinks + graph view

- [ ] Wiki link syntax [[...]] creation UI (autocomplete)
- [ ] Backlinks panel (linked mentions)
- [ ] Graph view (sigma.js) project graph + current note neighborhood
- [ ] Graph interactions: click node opens note tab
- [ ] Unit tests for link parsing and graph edge generation
- [ ] E2E: create links, graph shows edge, click navigates

## Milestone 8 — Templates + metadata + favorites + trash polish

- [ ] Templates manager + apply template on new note
- [ ] Favorites view + star toggles in list/editor
- [ ] Metadata panel with custom fields CRUD
- [ ] Trash view polish with restore/permanent delete confirm
- [ ] E2E: create template, new note from template, persists

## Milestone 9 — File System Access (disk vault) + hybrid cache

- [ ] FileSystemAdapter implementing disk layout in storage.md
- [ ] Onboarding option for folder vault (feature-detect)
- [ ] Permissions handling + recovery UI
- [ ] Hybrid cache: store search index + uiState in IDB even for disk mode
- [ ] E2E (Chromium): choose folder, create note, verify files exist (via adapter mocks if needed)

## Milestone 10 — Visual perfection + accessibility + hardening

- [ ] Implement all styling rules in brand.md and ui-spec.md (no drift)
- [ ] Add motion per brand rules + reduced motion support
- [ ] Add accessibility pass: focus order, ARIA labels, contrast checks
- [ ] Add error boundaries + safe toasts for adapter failures
- [ ] Add performance checks: list virtualization, search latency budget tests (synthetic)
- [ ] Final E2E sweep on Chromium/Firefox/WebKit
