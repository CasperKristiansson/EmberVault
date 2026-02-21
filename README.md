# EmberVault

Local-first notes. No accounts. Optional direct-to-S3 sync.

EmberVault is a dark-mode, macOS-inspired notes app that runs in the browser while keeping everything on your device by default. It is built for speed, privacy, and a calm writing environment, with optional direct AWS S3 sync (no backend service).

![EmberVault Hero](docs/images/hero.png)

## What it is

- **Local-first notes** — your data stays on your device by default.
- **Three storage modes**
  - **Folder vault** (best on Chrome/Edge): notes live in a user-chosen folder on disk.
  - **Browser storage** (IndexedDB): quick setup and works across modern browsers.
  - **AWS S3 sync**: optional client-direct sync to your bucket (`bucket + region + prefix + credentials`).
- **Single workspace** organized with **folders + tags**.
- **Powerful editor**: block-based, Markdown-friendly, with code blocks, tables, checklists, quotes, dividers, and LaTeX math.
- **Fast navigation**: full-text search (filters + fuzzy), tabs, and split panes.
- **Right panel** for outline + metadata.
- **Favorites + Trash** (restore supported).

## Screenshots

### App

![EmberVault App](docs/images/app.png)

### Settings

![EmberVault Settings](docs/images/settings.png)

## Why it exists

This is a side project focused on exploring a polished local-first UX and modern web tooling. It’s built as a product-style prototype.

## Notes

- EmberVault is **offline-first** after the first load.
- Folder vault uses the browser’s folder permission model (Chrome/Edge best experience).
- S3 mode uses your own bucket and credentials directly in the client (no app backend).
- No accounts. No tracking.
- S3 troubleshooting guide: `docs/s3-runbook.md`.
