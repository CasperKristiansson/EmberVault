# Local-Only Notes (Web App) — Technical Specification

Version: 0.1 Owner: (you) Audience: Coding agent (primary)

## 0) Non-negotiables

- Web app only. No backend. No accounts.
- Default storage is local-only (device folder or browser storage). Optional AWS S3 mode writes directly to a user-provided bucket using user-provided credentials (no server-side component).
- Offline-first: app must function fully without network once loaded once.
- Dark theme only, macOS-like minimal UI, orange accent.
- Fast: instant navigation, no jank, virtualized lists, incremental indexing.
- Block editor as the primary editor, with strong Markdown interoperability (import/export + paste handling).
- Works on all modern browsers; primary usage is Chrome.
- Cross-browser storage strategy must degrade gracefully (Chrome best experience with “write-to-disk”).

## 1) Feature set (overview)

### 1.1 Core

- Single workspace (folders only)
- Folders + Tags (both)
- Favorites (pinned notes)
- Metadata panel (system fields + custom fields)
- Tabs (single editor pane)
- Drag & drop (folders, notes, tabs)
- Search: full-text + filters + fuzzy
- Command palette (Cmd/Ctrl+K)
- Keyboard-first UX with comprehensive shortcuts
- Soft delete (Trash), restore, and permanent delete

### 1.2 Content

- Block editor (ProseMirror/Tiptap-based)
- Blocks: paragraph, heading, bulleted list, numbered list, checklist, quote, divider, code block, table, image, callout, embed/link preview (URL)
- Inline: bold, italic, underline, strike, code, link
- Syntax highlighting for code blocks
- LaTeX math (inline + block) rendered via KaTeX
- Images: paste from clipboard + drag-drop into editor; stored locally; displayed inline with resize + caption

## 2) Tech stack (chosen)

### 2.1 Framework

- SvelteKit + TypeScript (new vs React/Next)
- Build: Vite (via SvelteKit)
- Package manager: pnpm
- Adapter: @sveltejs/adapter-static (SPA fallback via 200.html for S3/CloudFront hosting)
- Styling: plain CSS with design tokens (CSS variables) + CSS modules (component-scoped)
- UI primitives: Melt UI (headless, accessible) + custom styling (no Tailwind)
- Motion: @motionone/svelte (micro-animations)
- Icons: lucide-svelte

### 2.2 Editor

- Tiptap v2 (ProseMirror) for the block editor
- Tiptap packages: @tiptap/core, @tiptap/pm, @tiptap/starter-kit
- Key extensions:
  - StarterKit (selectively enabled)
  - TaskList + TaskItem (checklists)
  - Table + TableRow + TableHeader + TableCell
  - CodeBlockLowlight + lowlight (syntax highlight)
  - Image (asset-backed image blocks)
  - Link
  - Placeholder
  - History (undo/redo)
  - Markdown interoperability:
    - Import: parse Markdown -> ProseMirror doc
    - Export: ProseMirror doc -> Markdown
  - Math:
    - KaTeX renderer for inline/block math nodes (katex package)

### 2.3 Search

- MiniSearch for full-text indexing with fuzzy matching
- Index persisted locally (IDB) and rebuilt incrementally as needed

### 2.4 Graph view

Removed.

### 2.5 Storage

Hybrid, capability-driven:

- Primary (best): File System Access API (Chrome/Edge) — user selects a directory (“Vault”)
- Universal fallback: IndexedDB (all browsers)
- Optional: AWS S3 storage mode (user-provided bucket + credentials; no backend)
- Optional performance add-on (Chrome): OPFS via Storage Foundation if available (not required)
- Persist the user’s storage choice (and FS directory handle when applicable) in IndexedDB to avoid re-prompting on every launch

AWS S3 implementation:
- Uses AWS SDK v3 (`@aws-sdk/client-s3`) in the client bundle.
- Credentials are stored in IndexedDB app settings when the user enables S3 mode.

See `storage.md` for canonical on-disk structure and fallback rules.

### 2.6 Deployment

- Static hosting on AWS S3 + CloudFront + Route53 (custom domain).
- IaC: Pulumi (TypeScript) under `infra/`.
- Certificates: ACM in us-east-1 for CloudFront.

## 3) Information architecture

### 3.1 Entities

- Vault (storage root; either disk directory or IDB namespace)
- Folder (tree)
- Note
- Tag
- Template (reserved; not user-facing)
- Asset (image blob + metadata)
- UI State (tabs, pane layout, last opened, sidebar widths)
- App Settings (global settings such as storage mode + vault handle)

### 3.2 Vault structure

- The vault contains:
  - Folder tree
  - Notes list
  - Tags dictionary
  - Saved searches (optional)

## 4) Application views (must implement)

- Onboarding / Vault selection
- Main workspace:
  - Sidebar (folder tree)
  - Note list pane
  - Editor pane (tabs)
  - Right panel (toggleable): Outline / Metadata
- Command palette
- Global search modal
- Favorites view
- Trash view
- Settings

See `ui-spec.md` for pixel-level UI behavior.

## 5) Offline-first requirements

- Service worker caches:
  - App shell assets (HTML/CSS/JS/fonts/icons)
  - No remote data dependencies required
- If network is unavailable:
  - App loads from cache (after first visit)
  - All vault data accessible locally
- “First visit offline” is not required.

## 6) Performance budgets (hard targets)

- Notes list scroll: 60fps on mid-range laptop
- Open note: < 50ms perceived (show skeleton instantly, content paint quickly)
- Search typing: results update within 80ms for 1k notes (debounce 50ms)

Implementation requirements:

- Virtualize note list and search results (windowing)
- Debounce expensive operations
- Incremental indexing: update index for changed notes only
- Avoid re-parsing markdown on every keystroke; export on save debounce

## 7) Data integrity + autosave

- Autosave always on
- Save strategy:
  - Editor updates in memory on every transaction
  - Persist to storage with a debounce of 400ms (reset on input)
  - Immediate persist on:
    - tab switch
    - note switch
    - app background/unload (best-effort)
- Soft delete:
  - Deleted notes moved to Trash with deletedAt timestamp
  - Restore returns to original folder (if exists), else root
- Maintenance tools (Settings):
  - Backup (single file): download/restore a compressed JSON backup (restoring replaces current vault contents)
  - Vault integrity check: scans for missing notes/assets and safe cleanup opportunities
  - Repair: applies safe fixes (prune missing note index entries, delete orphan assets, fix folder references)

## 8) Testing + CI (must be fully automated)

- Unit tests: Vitest
- Component tests: @testing-library/svelte
- Test environment: Vitest uses jsdom for component tests
- IndexedDB unit tests: fake-indexeddb provides the IDB globals
- E2E: Playwright (Chromium + WebKit + Firefox)
- Playwright config: runs headless across Chromium/Firefox/WebKit via `pnpm test:e2e`
- Accessibility smoke: axe-core integration in Playwright for key screens
- Lint: ESLint + TypeScript strict + Prettier (https://github.com/haydenbleasel/ultracite, A production-grade, zero-configuration preset for ESLint, Biome, and Oxlint.)
  - Config: `eslint.config.mjs`, `prettier.config.mjs`, `stylelint.config.mjs` use ultracite presets
  - Notes: `tailwindcss@3` installed to satisfy `eslint-plugin-tailwindcss` (not used for styling)
  - ESLint config uses a local copy of ultracite core rules to avoid ESLint 9 frozen rule objects
- CI gates:
  - All tests pass in CI
  - No TypeScript errors
  - Playwright runs headless on all 3 engines
  - Minimum coverage: 80% lines on core packages (storage + search + parser)

See `testing.md` for detailed test plan.

## 9) Done criteria (release)

- All milestones complete and checked in `milestones.md`
- All CI gates green
- Manual review only after completion (agent must self-verify with tests)
