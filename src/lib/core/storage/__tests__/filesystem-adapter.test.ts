import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileSystemAdapter } from "../filesystem.adapter";
import { deleteIndexedDatabase, IndexedDBAdapter } from "../indexeddb.adapter";
import type { NoteDocumentFile, Project } from "../types";

type MemoryFileHandle = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{
    write: (data: unknown) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type MemoryDirectoryHandle = {
  kind: "directory";
  name: string;
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<MemoryDirectoryHandle>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<MemoryFileHandle>;
  removeEntry: (name: string) => Promise<void>;
  values: () => AsyncIterableIterator<MemoryHandle>;
};

type MemoryHandle = MemoryDirectoryHandle | MemoryFileHandle;

// eslint-disable-next-line @typescript-eslint/require-await
const tick = async (): Promise<void> => undefined;

const createNotFoundError = (message: string): Error => {
  const error = new Error(message);
  error.name = "NotFoundError";
  return error;
};

const createAsyncIterator = <T>(
  iterable: Iterable<T>
): AsyncIterableIterator<T> => {
  const iterator = iterable[Symbol.iterator]();
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next: async () => {
      await tick();
      return iterator.next();
    },
  };
};

const createMemoryFileHandle = (
  name: string,
  initialData: Blob | string = ""
): MemoryFileHandle => {
  let data: Blob | Uint8Array | string = initialData;
  return {
    name,
    kind: "file",
    getFile: async () => {
      await tick();
      let textValue = "";
      if (typeof data === "string") {
        textValue = data;
      } else if (data instanceof Uint8Array) {
        textValue = new TextDecoder().decode(data);
      }
      let mimeType = "";
      if (typeof data === "string") {
        mimeType = "text/plain";
      } else if (data instanceof Blob) {
        mimeType = data.type;
      }
      const fileParts: BlobPart[] = [];
      if (data instanceof Uint8Array) {
        const buffer = new ArrayBuffer(data.byteLength);
        new Uint8Array(buffer).set(data);
        fileParts.push(buffer);
      } else {
        fileParts.push(data);
      }
      const file = new File(fileParts, name, { type: mimeType });
      if (typeof file.text !== "function") {
        Object.assign(file, {
          text: async () => {
            await tick();
            return textValue;
          },
        });
      }
      return file;
    },
    createWritable: async () => {
      await tick();
      return {
        async write(input) {
          await tick();
          if (input instanceof Blob) {
            data = input;
            return;
          }
          if (input instanceof ArrayBuffer) {
            data = new Uint8Array(input);
            return;
          }
          if (input instanceof Uint8Array) {
            data = input;
            return;
          }
          data = String(input);
        },
        close: async () => {
          await tick();
        },
      };
    },
  };
};

const createMemoryDirectoryHandle = (name: string): MemoryDirectoryHandle => {
  const entries = new Map<string, MemoryHandle>();
  return {
    name,
    kind: "directory",
    getDirectoryHandle: async (childName, options) => {
      await tick();
      const existing = entries.get(childName);
      if (existing?.kind === "directory") {
        return existing;
      }
      if (options?.create) {
        const created = createMemoryDirectoryHandle(childName);
        entries.set(childName, created);
        return created;
      }
      throw createNotFoundError(`Missing directory ${childName}`);
    },
    getFileHandle: async (childName, options) => {
      await tick();
      const existing = entries.get(childName);
      if (existing?.kind === "file") {
        return existing;
      }
      if (options?.create) {
        const created = createMemoryFileHandle(childName);
        entries.set(childName, created);
        return created;
      }
      throw createNotFoundError(`Missing file ${childName}`);
    },
    async removeEntry(entryName) {
      await tick();
      if (!entries.has(entryName)) {
        throw createNotFoundError(`Missing entry ${entryName}`);
      }
      entries.delete(entryName);
    },
    values: () => createAsyncIterator(entries.values()),
  };
};

const isNotFoundError = (error: unknown): boolean =>
  error instanceof Error && error.name === "NotFoundError";

const createProject = (): Project => ({
  id: "project-1",
  name: "Personal",
  createdAt: 1,
  updatedAt: 1,
  folders: {},
  tags: {},
  notesIndex: {},
  templatesIndex: {},
  settings: {},
});

const createNoteDocument = (
  overrides: Partial<NoteDocumentFile> = {}
): NoteDocumentFile => ({
  id: "note-1",
  title: "Daily note",
  createdAt: 1,
  updatedAt: 1,
  folderId: null,
  tagIds: [],
  favorite: false,
  deletedAt: null,
  customFields: {},
  pmDoc: { type: "doc", content: [] },
  derived: {
    plainText: "Daily note",
    outgoingLinks: [],
  },
  ...overrides,
});

const getProjectDirectories = async (
  root: MemoryDirectoryHandle,
  projectId: string
): Promise<{
  notes: MemoryDirectoryHandle;
  templates: MemoryDirectoryHandle;
  assets: MemoryDirectoryHandle;
  trash: MemoryDirectoryHandle;
}> => {
  const projectsRoot = await root.getDirectoryHandle("projects");
  const projectDirectory = await projectsRoot.getDirectoryHandle(projectId);
  return {
    notes: await projectDirectory.getDirectoryHandle("notes"),
    templates: await projectDirectory.getDirectoryHandle("templates"),
    assets: await projectDirectory.getDirectoryHandle("assets"),
    trash: await projectDirectory.getDirectoryHandle("trash"),
  };
};

const hasFile = async (
  directory: MemoryDirectoryHandle,
  name: string
): Promise<boolean> => {
  try {
    await directory.getFileHandle(name);
    return true;
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }
    throw error;
  }
};

describe("FileSystemAdapter", () => {
  // eslint-disable-next-line @typescript-eslint/init-declarations
  let root: MemoryDirectoryHandle;
  // eslint-disable-next-line @typescript-eslint/init-declarations
  let adapter: FileSystemAdapter;
  // eslint-disable-next-line @typescript-eslint/init-declarations
  let project: Project;
  beforeEach(async () => {
    await deleteIndexedDatabase();
    root = createMemoryDirectoryHandle("root");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const rootHandle = root as unknown as FileSystemDirectoryHandle;
    adapter = new FileSystemAdapter(rootHandle);
    await adapter.init();
    project = createProject();
    await adapter.createProject(project);
  });

  afterEach(async () => {
    await deleteIndexedDatabase();
  });

  it("writes, reads, and lists notes with markdown snapshots", async () => {
    const note = createNoteDocument();
    const markdown = "# Daily note";

    await adapter.writeNote({
      projectId: project.id,
      noteId: note.id,
      noteDocument: note,
      derivedMarkdown: markdown,
    });

    const stored = await adapter.readNote(project.id, note.id);
    expect(stored).toEqual(note);

    const list = await adapter.listNotes(project.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: note.id,
      title: note.title,
      deletedAt: null,
    });

    const directories = await getProjectDirectories(root, project.id);
    const noteHandle = await directories.notes.getFileHandle(`${note.id}.md`);
    const noteFile = await noteHandle.getFile();
    const noteMarkdown = await noteFile.text();
    expect(noteMarkdown).toBe(markdown);
  });

  it("moves notes to trash, restores them, and writes assets/templates", async () => {
    const note = createNoteDocument();
    await adapter.writeNote({
      projectId: project.id,
      noteId: note.id,
      noteDocument: note,
      derivedMarkdown: "# Daily note",
    });

    await adapter.deleteNoteSoft(project.id, note.id);
    const trashed = await adapter.readNote(project.id, note.id);
    expect(trashed?.deletedAt).not.toBeNull();

    const directories = await getProjectDirectories(root, project.id);
    expect(await hasFile(directories.notes, `${note.id}.json`)).toBe(false);
    expect(await hasFile(directories.trash, `${note.id}.json`)).toBe(true);

    await adapter.restoreNote(project.id, note.id);
    const restored = await adapter.readNote(project.id, note.id);
    expect(restored?.deletedAt).toBeNull();
    expect(await hasFile(directories.notes, `${note.id}.json`)).toBe(true);
    expect(await hasFile(directories.trash, `${note.id}.json`)).toBe(false);

    const template = createNoteDocument({ id: "template-1", isTemplate: true });
    await adapter.writeTemplate({
      projectId: project.id,
      templateId: template.id,
      noteDocument: template,
      derivedMarkdown: "# Template",
    });
    const templates = await adapter.listTemplates(project.id);
    expect(templates).toHaveLength(1);
    expect(templates[0]?.id).toBe(template.id);

    const assetBlob = new Blob(["asset"], { type: "image/png" });
    await adapter.writeAsset({
      projectId: project.id,
      assetId: "asset-1",
      blob: assetBlob,
      meta: { mime: "image/png" },
    });
    const assets = await adapter.listAssets(project.id);
    expect(assets).toContain("asset-1");
    const storedAsset = await adapter.readAsset(project.id, "asset-1");
    expect(storedAsset).not.toBeNull();
  });

  it("persists ui state and search index in the IDB cache", async () => {
    await adapter.writeUIState({ lastProjectId: project.id });
    await adapter.writeSearchIndex(project.id, "snapshot");

    const state = await adapter.readUIState();
    expect(state).toEqual({ lastProjectId: project.id });

    const snapshot = await adapter.readSearchIndex(project.id);
    expect(snapshot).toBe("snapshot");

    const cacheAdapter = new IndexedDBAdapter();
    await cacheAdapter.init();
    const cachedState = await cacheAdapter.readUIState();
    expect(cachedState).toEqual({ lastProjectId: project.id });
    const cachedSnapshot = await cacheAdapter.readSearchIndex(project.id);
    expect(cachedSnapshot).toBe("snapshot");
  });
});
