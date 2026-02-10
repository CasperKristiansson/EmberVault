import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDefaultVault,
  deleteIndexedDatabase,
  IndexedDBAdapter,
} from "../indexeddb.adapter";
import type { NoteDocumentFile } from "../types";

const defaultTemplateTitle = "Meeting template";
const defaultMarkdown = "# Meeting template";
const updatedTemplateTitle = "Updated template";
const updatedMarkdown = "# Updated template";

const createTemplateDocument = (
  overrides: Partial<NoteDocumentFile> = {}
): NoteDocumentFile => ({
  id: "template-1",
  title: defaultTemplateTitle,
  createdAt: 1,
  updatedAt: 1,
  folderId: null,
  tagIds: [],
  favorite: false,
  deletedAt: null,
  customFields: {},
  pmDoc: { type: "doc", content: [] },
  derived: {
    plainText: defaultTemplateTitle,
    outgoingLinks: [],
  },
  isTemplate: true,
  ...overrides,
});

describe("IndexedDBAdapter template persistence", () => {
  beforeEach(async () => {
    await deleteIndexedDatabase();
  });

  afterEach(async () => {
    await deleteIndexedDatabase();
  });

  it("writes, reads, lists, and deletes templates", async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    const vault = createDefaultVault();
    await adapter.writeVault(vault);

    const template = createTemplateDocument();
    await adapter.writeTemplate({
      templateId: template.id,
      noteDocument: template,
      derivedMarkdown: defaultMarkdown,
    });

    const stored = await adapter.readTemplate(template.id);
    expect(stored).toEqual(template);

    const listed = await adapter.listTemplates();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      id: template.id,
      title: template.title,
      isTemplate: true,
    });

    const updatedTemplate = createTemplateDocument({
      title: updatedTemplateTitle,
      updatedAt: 2,
    });

    await adapter.writeTemplate({
      templateId: updatedTemplate.id,
      noteDocument: updatedTemplate,
      derivedMarkdown: updatedMarkdown,
    });

    const refreshed = await adapter.readTemplate(updatedTemplate.id);
    expect(refreshed?.title).toBe(updatedTemplateTitle);

    const refreshedList = await adapter.listTemplates();
    expect(refreshedList).toHaveLength(1);
    expect(refreshedList[0]?.title).toBe(updatedTemplateTitle);

    await adapter.deleteTemplate(updatedTemplate.id);

    const deleted = await adapter.readTemplate(updatedTemplate.id);
    expect(deleted).toBeNull();

    const remaining = await adapter.listTemplates();
    expect(remaining).toHaveLength(0);
  });
});
