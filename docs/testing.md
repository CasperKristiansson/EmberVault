# Testing Plan (CI-gated, no human verification)

## 1) Tooling

- Unit: Vitest
- Component: Testing Library (Svelte)
- E2E: Playwright (Chromium, Firefox, WebKit)
- A11y: axe-core in Playwright
- Lint/format: ESLint + Prettier (https://github.com/haydenbleasel/ultracite, A production-grade, zero-configuration preset for ESLint, Biome, and Oxlint.)
- TypeScript: strict

## 2) Required unit tests

Storage:

- create/read/write note (IDB)
- soft delete -> appears in trash; restore returns
- asset write/read; dedupe by hash
- adapter switching behavior (FS failure -> fallback prompt logic via mocked adapter)

Search:

- index build for 1k notes (synthetic) completes and queries return stable ordering
- fuzzy queries match expected notes
- incremental update updates results without full rebuild

Markdown:

- import markdown -> pmDoc contains expected nodes (headings, lists, code)
- export pmDoc -> markdown contains expected constructs

Links:

- parse outgoing links

## 3) Required component tests

- Sidebar folder drag-and-drop indicator shows
- Note list virtualization renders correct selection/hover
- Command palette keyboard navigation
- Right panel tabs (outline/metadata) toggle correctly

## 4) Required E2E tests (Playwright)

- Onboarding:
  - choose browser storage -> app opens default vault
- CRUD:
  - create note, type content, reload -> content persists
- Editor blocks:
  - insert checklist, code block (with language), table
  - paste image -> image persists after reload
- Search:
  - global search returns results with snippets
- Tabs/panes:
  - dock notes into multiple panes (right, right, then top), reload -> pane layout persists
- Trash:
  - delete note -> appears in trash -> restore -> returns to folder
- Cross-browser:
  - run same suite on WebKit at minimum for IDB mode

## 5) CI gates

- `pnpm test` must pass
- `pnpm test:e2e` must pass for all engines
- coverage >= 80% on core modules (storage/search/parser)
- lint + typecheck pass
