# Coding Agent Operating Rules (must follow)

## 1) Source of truth

- UI behavior: docs/ui-spec.md + docs/brand.md
- Architecture/data: docs/technical-spec.md + docs/storage.md + docs/data-model.md If any conflict exists, stop and resolve by updating specs (do not invent).

## 2) No drift policy

- Do not change color palette, radii, spacing, or layout patterns.
- Do not introduce new dependencies unless required; if introduced, document in technical-spec.md.

## 3) Testing policy

- Every feature must ship with:
  - unit tests for logic
  - e2e tests for user flows
- All tests must run headlessly and pass in CI without human intervention.

## 4) Performance policy

- Virtualize lists > 100 items.
- Debounce saves and indexing.
- Avoid expensive parsing on keystroke.

## 5) Definition of done (per PR)

- Typecheck + lint + unit + e2e green
- Updated docs if behavior changed
- No console errors in e2e runs

# Tooling (Ultracite)

This project uses **Ultracite** presets for ESLint, Prettier, and Stylelint.

Quick reference:

- Format: `pnpm dlx ultracite fix`
- Lint check: `pnpm lint`
- Diagnose setup: `pnpm dlx ultracite doctor`

Notes:

- Config files: `eslint.config.mjs`, `prettier.config.mjs`, `stylelint.config.mjs`.
- A local copy of Ultracite's core ESLint rules lives under `config/eslint/` to stay compatible with ESLint 9.
- Lefthook runs `pnpm dlx ultracite fix` on pre-commit.

If Ultracite or ESLint changes in the future, update this section and keep the configs in sync with `docs/technical-spec.md`.

## Coding Guidelines (SvelteKit + TypeScript)

- Prefer explicit types when they improve clarity; avoid `any`.
- Use `const` by default; avoid `var`.
- Use `async/await` for async code; handle errors with `try/catch`.
- Avoid `console.log`, `debugger`, and `alert` in committed code.
- Use semantic HTML and proper ARIA labels for accessibility.
- For Svelte: use `class` and `for` attributes (not `className`/`htmlFor`).
- For security: avoid `eval`, sanitize inputs, and add `rel="noopener"` to `target="_blank"` links.

## Testing

- Write assertions inside `it()`/`test()` blocks.
- Avoid `.only`/`.skip` in committed code.
- Prefer async/await over done callbacks.
