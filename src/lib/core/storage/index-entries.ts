import { resolveNotePreview } from "$lib/core/utils/note-preview";
import type {
  NoteDocumentFile,
  NoteIndexEntry,
  TemplateIndexEntry,
} from "./types";

export const toNoteIndexEntry = (
  noteDocument: NoteDocumentFile
): NoteIndexEntry => {
  const hasCustomFields = Object.keys(noteDocument.customFields).length > 0;
  const preview = resolveNotePreview(noteDocument.derived?.plainText);
  return {
    id: noteDocument.id,
    title: noteDocument.title,
    ...(preview ? { preview } : {}),
    folderId: noteDocument.folderId,
    tagIds: noteDocument.tagIds,
    favorite: noteDocument.favorite,
    createdAt: noteDocument.createdAt,
    updatedAt: noteDocument.updatedAt,
    deletedAt: noteDocument.deletedAt,
    isTemplate: noteDocument.isTemplate ?? false,
    ...(hasCustomFields ? { customFields: noteDocument.customFields } : {}),
    ...(noteDocument.derived?.outgoingLinks
      ? { linkOutgoing: noteDocument.derived.outgoingLinks }
      : {}),
  };
};

export const toTemplateIndexEntry = (
  templateDocument: NoteDocumentFile
): TemplateIndexEntry => {
  const base = toNoteIndexEntry(templateDocument);
  return {
    ...base,
    isTemplate: true,
  };
};
