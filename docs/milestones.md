# Milestones (Agent Checklist)

Rule: each milestone must end with green CI (unit + e2e + typecheck + lint). No partial merges.

## Milestone 0 — Repo + tooling baseline

- [x] Initialize SvelteKit + TypeScript project (pnpm)
- [x] Configure ESLint + Prettier + strict TS
- [x] Add Vitest + Testing Library (Svelte)
- [x] Add Playwright (Chromium/Firefox/WebKit) + basic smoke test
- [x] Add CI workflow running lint/typecheck/unit/e2e
- [x] Add design tokens CSS file (from brand.md) and verify applied globally

## Milestone 1 — Storage foundation (IDB first)

- [x] Deploy static site via adapter-static + Pulumi (S3/CloudFront/Route53)
- [x] Implement StorageAdapter interface
- [x] Implement IndexedDBAdapter with object stores per storage.md
- [x] Implement Project create/read/update, default “Personal”
- [x] Implement Note CRUD + soft delete + restore + permanent delete
- [x] Implement Asset storage (blob) in IDB
- [x] Unit tests for all IDB storage operations
- [x] E2E: create/edit note, reload persists

## Milestone 2 — App shell + navigation skeleton

- [x] Build app shell layout (sidebar, note list, editor pane, right panel)
- [x] Implement responsive rules (desktop + mobile layout)
- [x] Implement project switcher (single project ok for now)
- [x] Implement folder tree (create/rename/delete empty)
- [x] Implement note list with virtualization
- [x] Component tests for layout focus + basic navigation
- [x] E2E: create folder, create note in folder, list shows correct

## Milestone 3 — Block editor MVP (Tiptap)

- [x] Integrate Tiptap editor with required extensions (checklist, table, code, link)
- [x] Title field + autosave pipeline (debounced)
- [x] Slash menu for block insertion
- [x] Undo/redo wired
- [x] Code block syntax highlighting
- [x] Unit tests: editor doc save/load stable
- [x] E2E: create blocks, reload preserves structure

## Milestone 4 — Images + LaTeX

- [x] Paste image -> asset stored -> image block inserted
- [x] Drag-drop image -> same behavior
- [x] Image rendering with caption + lightbox modal (blur rules)
- [x] Implement math nodes + KaTeX render (inline + block)
- [x] Unit tests for asset dedupe + math serialize/deserialize
- [x] E2E: paste image, reload; insert LaTeX, reload

## Milestone 5 — Search + command palette

- [x] Implement MiniSearch index build + persistence
- [x] Incremental indexing on note save/delete/restore
- [x] Global search modal with filters + fuzzy
- [x] Command palette (Cmd/Ctrl+K) with actions + note switching
- [x] Unit tests for fuzzy search correctness
- [x] E2E: search finds note by partial typo

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
