# Coding Agent Operating Rules (must follow)

## 1) Source of truth

- UI behavior: docs/ui-spec.md + docs/brand.md
- Architecture/data: docs/technical-spec.md + docs/storage.md + docs/data-model.md
  If any conflict exists, stop and resolve by updating specs (do not invent).

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
