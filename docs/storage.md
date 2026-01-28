# Storage Specification (Disk + IndexedDB Hybrid)

## 1) Goals

- Best experience: user-selected folder on disk (Chrome/Edge).
- Universal fallback: IndexedDB.
- Optional hybrid: even in disk mode, keep a small IDB cache for search index + UI state.

## 2) Storage adapter interface

Implement `StorageAdapter` with:

- init()
- listProjects()
- createProject()
- readProject(projectId)
- writeProject(projectId, projectMeta)
- listNotes(projectId)
- readNote(projectId, noteId)
- writeNote({ projectId, noteId, noteDocument, derivedMarkdown })
- deleteNoteSoft(projectId, noteId)
- restoreNote(projectId, noteId)
- deleteNotePermanent(projectId, noteId)
- writeAsset({ projectId, assetId, blob, meta })
- readAsset(projectId, assetId)
- listAssets(projectId)
- writeUIState(state)
- readUIState()

Adapters:

- FileSystemAdapter (File System Access API)
- IndexedDBAdapter (fallback)

Selection logic:

- If FS API supported AND user chooses folder: FileSystemAdapter primary, plus IDB cache for index/state.
- Else: IndexedDBAdapter only.

## 3) On-disk layout (FileSystemAdapter)

Vault root folder:

- vault.json
- projects/
  - {projectId}/
    - project.json
    - notes/
      - {noteId}.json (canonical ProseMirror doc + metadata)
      - {noteId}.md (derived export, updated on save debounce)
    - templates/
      - {templateId}.json
      - {templateId}.md
    - assets/
      - {assetId}.{ext}
      - assets.json (asset registry optional; can derive by scanning)
    - trash/
      - {noteId}.json
      - {noteId}.md

Canonical rules:

- Canonical content is `{noteId}.json` (ProseMirror/Tiptap document + note metadata).
- Markdown is derived for export/interoperability and must be kept reasonably in sync.

project.json contains:

- folder tree
- note index (id -> title, folderId, tags, createdAt, updatedAt, favorite, deletedAt?)
- tag dictionary
- template index
- settings (per project)

## 4) IndexedDB layout (IndexedDBAdapter)

DB name: `local-notes` Object stores:

- projects (key: projectId)
- notes (compound key: [projectId, noteId])
- templates (compound key: [projectId, templateId])
- assets (compound key: [projectId, assetId]) -> Blob
- uiState (key: "ui")
- searchIndex (key: projectId) -> serialized MiniSearch index

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
  - Provide “Export project to folder” and “Import from folder” utilities (post-MVP ok)

## 7) Autosave & consistency

- Debounced save: 400ms
- Save pipeline:
  1. Update note in memory store
  2. Persist note.json
  3. Persist derived note.md
  4. Update project.json note index updatedAt/title/tags
  5. Update MiniSearch index (incremental)
- On crash:
  - Next load uses canonical note.json; markdown may lag (acceptable)
