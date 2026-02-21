# Storage Specification (Disk + IndexedDB Hybrid)

## 1) Goals

- Best experience: user-selected folder on disk (Chrome/Edge).
- Universal fallback: IndexedDB.
- Optional: AWS S3 storage mode (user-provided bucket + credentials; no backend).
- Optional hybrid: even in disk mode, keep a small IDB cache for search index + UI state.

## 2) Storage adapter interface

Implement `StorageAdapter` with:

- init()
- readVault()
- writeVault(vault)
- listNotes()
- readNote(noteId)
- writeNote({ noteId, noteDocument, derivedMarkdown })
- deleteNoteSoft(noteId)
- restoreNote(noteId)
- deleteNotePermanent(noteId)
- listTemplates()
- readTemplate(templateId)
- writeTemplate({ templateId, noteDocument, derivedMarkdown })
- deleteTemplate(templateId)
- writeAsset({ assetId, blob, meta })
- readAsset(assetId)
- deleteAsset(assetId)
- listAssets()
- writeUIState(state)
- readUIState()
- writeSearchIndex(snapshot)
- readSearchIndex()
- getSyncStatus()
- flushPendingSync()

Adapters:

- FileSystemAdapter (File System Access API)
- IndexedDBAdapter (fallback)
- S3Adapter (AWS S3 bucket + client-side credentials; IndexedDB cache)

Selection logic:

- If FS API supported AND user chooses folder: FileSystemAdapter primary, plus IDB cache for index/state.
- Else: IndexedDBAdapter only.
- If user chooses AWS S3: S3Adapter primary, plus IndexedDB cache for offline-first and performance.
- Persist the user’s storage choice and (if applicable) the directory handle in IndexedDB so we can restore without re-prompting.
- On app start:
  - If stored choice = FileSystemAdapter and the handle is still valid/permissioned, open it directly (no onboarding prompt).
  - If stored choice = FileSystemAdapter but permission is denied or handle is invalid, show the blocking dialog (retry or switch to IDB).
  - If stored choice = IndexedDBAdapter, skip onboarding and use IDB.
  - If no stored choice, show onboarding selection.

## 3) On-disk layout (FileSystemAdapter)

Vault root folder:

- vault.json
- notes/
  - {noteId}.json (canonical ProseMirror doc + metadata)
  - {noteId}.md (derived export, updated on save debounce)
- templates/
  - {templateId}.json
  - {templateId}.md
  - (reserved; templates are not user-facing)
- assets/
  - {assetId}.{ext}
  - assets.json (asset registry optional; can derive by scanning)
- trash/
  - {noteId}.json
  - {noteId}.md

Canonical rules:

- Canonical content is `{noteId}.json` (ProseMirror/Tiptap document + note metadata).
- Markdown is derived for export/interoperability and must be kept reasonably in sync.

vault.json contains:

- folder tree
- note index (id -> title, folderId, tags, createdAt, updatedAt, favorite, deletedAt?)
- tag dictionary
- template index
  - (reserved; templates are not user-facing)
- settings (vault-level)
- uiState (workspace layout + tabs)
- searchIndex (serialized MiniSearch index)

## 4) IndexedDB layout (IndexedDBAdapter)

DB name: `local-notes` Object stores:
- vault (key: id = "vault")
- notes (key: noteId)
- templates (key: templateId)
  - (reserved; templates are not user-facing)
- assets (key: assetId) -> Blob
- uiState (key: "ui")
- searchIndex (key: "search") -> serialized MiniSearch index
- appSettings (key: "app") -> { storageMode: "filesystem" | "idb" | "s3", fsHandle?: FileSystemDirectoryHandle, lastVaultName?: string, s3?: { bucket: string, region: string, prefix?: string, accessKeyId: string, secretAccessKey: string, sessionToken?: string }, settings?: { ... } }
- syncOutbox (key: "key") -> queued S3 sync operations with metadata (`retryCount`, `lastAttemptAt`, `lastError`)
- syncMeta (key: "sync") -> persisted sync telemetry (`state`, `pendingCount`, `lastSuccessAt`, `lastError`, `lastInitResolution`)

Notes:
- appSettings lives in IndexedDB regardless of primary storage, and is used to remember the user’s storage choice across launches.
- settings is reserved for future global settings (non-vault-specific).
- Schema version is currently `5` with backward compatibility defaults for legacy outbox items.

## 5) Image handling

- On paste/drag:
  - Convert to Blob, detect mime
  - Generate assetId = sha-256(blob) hex (dedupe)
  - Store blob in adapter
  - Insert image block referencing assetId + mime + width/height (if known)
- Rendering:
  - FileSystemAdapter: createObjectURL from file handle
  - IndexedDBAdapter: createObjectURL from blob
- Keep an in-memory LRU cache of object URLs; revoke when evicted.

## 6) Migration + resilience

- If FileSystemAdapter fails (permissions revoked):
  - Show blocking dialog:
    - Retry access
    - Switch to browser storage (IndexedDB)
- Switching adapters:
  - Switching storage mode in Settings migrates the current vault into the newly selected storage (notes + assets + vault index) after an explicit confirmation.
  - Provide “Export vault to folder” and “Import from folder” utilities

## 6.1) Backup (Single File)

- Backup file: compressed JSON (gzip when supported), format `"embervault-backup"`, version `1`
- Contents:
  - Vault snapshot (folder tree, tags, note index, etc.)
  - Notes: canonical JSON plus derived Markdown
  - Assets: base64-encoded blobs with a stored mime type
- Restore behavior:
  - Best-effort deletes existing notes and assets first to avoid mixing vaults
  - Writes the vault, then writes notes, then writes assets

## 8) S3 layout (S3Adapter)

S3 keys are stored under a user-configurable `prefix` (default: `embervault/`).

- `{prefix}vault.json`
- `{prefix}notes/{noteId}.json`
- `{prefix}notes/{noteId}.md` (derived from `note.derived.plainText` for interoperability)
- `{prefix}templates/{templateId}.json`
- `{prefix}templates/{templateId}.md` (derived)
- `{prefix}assets/{assetId}` (blob; content-type set when available)
- `{prefix}ui-state.json` (optional; per-user convenience)
- `{prefix}search-index.json` (serialized MiniSearch index)

Notes:
- Soft-deleted notes remain under `notes/` and are hidden by `deletedAt` in the vault index.
- Sync policy: last-write-wins. Local cache is updated immediately; remote is updated via a coalesced outbox.
- Startup policy: remote-first for S3 mode with bounded retries (3 attempts, 7s timeout per attempt, 800/1600/3200ms backoff) and explicit failure recovery actions.

## 7) Autosave & consistency

- Debounced save: 400ms
- Save pipeline:
  1. Update note in memory store
  2. Persist note.json
  3. Persist derived note.md
  4. Update vault.json note index updatedAt/title/tags
  5. Update MiniSearch index (incremental)
- On crash:
  - Next load uses canonical note.json; markdown may lag (acceptable)
