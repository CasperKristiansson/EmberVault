# Data Model

## 1) IDs

- projectId, folderId, noteId, templateId, assetId:
  - ULID (time-sortable) for project/folder/note/template
  - assetId = sha-256(blob) hex

## 2) Project

Project { id: string name: string createdAt: number updatedAt: number folders: FolderTree tags: Record<tagId, Tag> notesIndex: Record<noteId, NoteIndexEntry> templatesIndex: Record<templateId, TemplateIndexEntry> settings: ProjectSettings }

Folder { id: string name: string parentId: string | null childFolderIds: string[] noteIds: string[] (optional ordering) }

Tag { id: string name: string color?: string (optional; default none) }

## 3) Note index entry (for list/search)

NoteIndexEntry { id: string title: string folderId: string | null tagIds: string[] favorite: boolean createdAt: number updatedAt: number deletedAt: number | null isTemplate: boolean (false for notes) customFields?: Record<string, CustomFieldValue> linkOutgoing?: string[] (noteIds or unresolved strings) linkIncomingCount?: number }

CustomFieldValue = string | number | boolean | { type:"date", value:number }

## 4) Note canonical doc file

NoteDocFile { id: string title: string createdAt: number updatedAt: number folderId: string | null tagIds: string[] favorite: boolean deletedAt: number | null customFields: Record<string, CustomFieldValue> pmDoc: object (ProseMirror JSON) derived: - plainText: string (optional cached) - outgoingLinks: string[] (cached) }

## 5) Links

Wiki links syntax: [[Note Title]] and [[noteId]] (internal stable) Resolution strategy:

- Prefer [[noteId]] when created by UI
- When user types [[Title]]:
  - resolve by exact title match in project
  - if ambiguous: link remains unresolved until user selects Graph edges:
- From note -> referenced note

## 6) Templates

Template is a NoteDocFile with isTemplate=true and stored under templates store/folder.
