import { IndexedDBAdapter } from "./indexeddb.adapter";
import type {
  AssetMeta,
  NoteDocumentFile,
  NoteIndexEntry,
  Project,
  StorageAdapter,
  TemplateIndexEntry,
  UIState,
} from "./types";

type VaultManifest = {
  version: number;
  uiState?: UIState;
  searchIndex?: Record<string, string>;
};

type ProjectDirectories = {
  project: FileSystemDirectoryHandle;
  notes: FileSystemDirectoryHandle;
  templates: FileSystemDirectoryHandle;
  assets: FileSystemDirectoryHandle;
  trash: FileSystemDirectoryHandle;
};

const vaultFileName = "vault.json";
const projectsDirectoryName = "projects";
const projectFileName = "project.json";
const notesDirectoryName = "notes";
const templatesDirectoryName = "templates";
const assetsDirectoryName = "assets";
const trashDirectoryName = "trash";

const isNotFoundError = (error: unknown): boolean =>
  error instanceof Error && error.name === "NotFoundError";

const isDirectoryHandle = (
  entry: FileSystemHandle
): entry is FileSystemDirectoryHandle => entry.kind === "directory";

const isFileHandle = (entry: FileSystemHandle): entry is FileSystemFileHandle =>
  entry.kind === "file";

const noteFileName = (noteId: string): string => `${noteId}.json`;
const noteMarkdownName = (noteId: string): string => `${noteId}.md`;
const templateFileName = (templateId: string): string => `${templateId}.json`;
const templateMarkdownName = (templateId: string): string => `${templateId}.md`;

const listDirectoryEntries = async (
  directory: FileSystemDirectoryHandle
): Promise<FileSystemHandle[]> => {
  const entries: FileSystemHandle[] = [];
  const iterator = directory.values();
  for await (const entry of iterator) {
    entries.push(entry);
  }
  return entries;
};

const readTextFile = async (
  directory: FileSystemDirectoryHandle,
  fileName: string
): Promise<string | null> => {
  try {
    const handle = await directory.getFileHandle(fileName);
    const file = await handle.getFile();
    return await file.text();
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
};

const writeTextFile = async (
  directory: FileSystemDirectoryHandle,
  fileName: string,
  contents: string
): Promise<void> => {
  const handle = await directory.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(contents);
  await writable.close();
};

const writeBlobFile = async (
  directory: FileSystemDirectoryHandle,
  fileName: string,
  blob: Blob
): Promise<void> => {
  const handle = await directory.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
};

const removeEntryIfExists = async (
  directory: FileSystemDirectoryHandle,
  name: string
): Promise<void> => {
  try {
    await directory.removeEntry(name);
  } catch (error) {
    if (isNotFoundError(error)) {
      return;
    }
    throw error;
  }
};

const readJsonFile = async <T>(
  directory: FileSystemDirectoryHandle,
  fileName: string
): Promise<T | null> => {
  const text = await readTextFile(directory, fileName);
  if (text === null) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return JSON.parse(text) as T;
};

const writeJsonFile = async (
  directory: FileSystemDirectoryHandle,
  fileName: string,
  payload: unknown
): Promise<void> => {
  const serialized = JSON.stringify(payload);
  await writeTextFile(directory, fileName, serialized);
};

const readProjectFile = async (
  projectDirectory: FileSystemDirectoryHandle
): Promise<Project | null> =>
  readJsonFile<Project>(projectDirectory, projectFileName);

const writeProjectFile = async (
  projectDirectory: FileSystemDirectoryHandle,
  project: Project
): Promise<void> => {
  await writeJsonFile(projectDirectory, projectFileName, project);
};

const findAssetHandle = async (
  assetsDirectory: FileSystemDirectoryHandle,
  assetId: string
): Promise<FileSystemFileHandle | null> => {
  const entries = await listDirectoryEntries(assetsDirectory);
  for (const entry of entries) {
    if (isFileHandle(entry)) {
      const { name } = entry;
      if (name === assetId || name.startsWith(`${assetId}.`)) {
        return entry;
      }
    }
  }
  return null;
};

const toNoteIndexEntry = (noteDocument: NoteDocumentFile): NoteIndexEntry => {
  const hasCustomFields = Object.keys(noteDocument.customFields).length > 0;
  return {
    id: noteDocument.id,
    title: noteDocument.title,
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

const toTemplateIndexEntry = (
  templateDocument: NoteDocumentFile
): TemplateIndexEntry => {
  const base = toNoteIndexEntry(templateDocument);
  return {
    ...base,
    isTemplate: true,
  };
};

const mimeToExtension: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const resolveAssetExtension = (mime?: string): string => {
  if (!mime) {
    return "bin";
  }
  return mimeToExtension[mime] ?? "bin";
};

const supportsIndexedDatabase = (): boolean => "indexedDB" in globalThis;

export class FileSystemAdapter implements StorageAdapter {
  private readonly root: FileSystemDirectoryHandle;
  private readonly cacheAdapter: IndexedDBAdapter | null;
  private cacheReady = false;

  public constructor(rootHandle: FileSystemDirectoryHandle) {
    this.root = rootHandle;
    this.cacheAdapter = supportsIndexedDatabase()
      ? new IndexedDBAdapter()
      : null;
  }

  public async init(): Promise<void> {
    await this.ensureVaultManifest();
    await this.getProjectsDirectory(true);
    if (this.cacheAdapter) {
      try {
        await this.cacheAdapter.init();
        this.cacheReady = true;
      } catch {
        this.cacheReady = false;
      }
    }
  }

  public async listProjects(): Promise<Project[]> {
    const projectsRoot = await this.getProjectsDirectory(true);
    const entries = await listDirectoryEntries(projectsRoot);
    const projects: Project[] = [];
    for (const entry of entries) {
      if (isDirectoryHandle(entry)) {
        // eslint-disable-next-line no-await-in-loop
        const project = await readProjectFile(entry);
        if (project) {
          projects.push(project);
        }
      }
    }
    return projects;
  }

  public async createProject(project: Project): Promise<void> {
    const existing = await this.readProject(project.id);
    if (existing) {
      throw new Error(
        `FileSystemAdapter.createProject project exists ${project.id}.`
      );
    }
    const directories = await this.ensureProjectDirectories(project.id);
    await writeProjectFile(directories.project, project);
  }

  public async readProject(projectId: string): Promise<Project | null> {
    try {
      const projectDirectory = await this.getProjectDirectory(projectId, false);
      return await readProjectFile(projectDirectory);
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  public async writeProject(
    projectId: string,
    projectMeta: Project
  ): Promise<void> {
    if (projectMeta.id !== projectId) {
      throw new Error(
        `FileSystemAdapter.writeProject id mismatch for ${projectId}.`
      );
    }
    const projectDirectory = await this.getProjectDirectory(projectId, false);
    await writeProjectFile(projectDirectory, projectMeta);
  }

  public async listNotes(projectId: string): Promise<NoteIndexEntry[]> {
    const project = await this.readProject(projectId);
    if (!project) {
      return [];
    }
    return Object.values(project.notesIndex);
  }

  public async listTemplates(projectId: string): Promise<TemplateIndexEntry[]> {
    const project = await this.readProject(projectId);
    if (!project) {
      return [];
    }
    return Object.values(project.templatesIndex);
  }

  public async readNote(
    projectId: string,
    noteId: string
  ): Promise<NoteDocumentFile | null> {
    try {
      const directories = await this.ensureProjectDirectories(projectId, false);
      const fileName = noteFileName(noteId);
      const storedNote = await readJsonFile<NoteDocumentFile>(
        directories.notes,
        fileName
      );
      if (storedNote) {
        return storedNote;
      }
      return await readJsonFile<NoteDocumentFile>(directories.trash, fileName);
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  public async readTemplate(
    projectId: string,
    templateId: string
  ): Promise<NoteDocumentFile | null> {
    try {
      const directories = await this.ensureProjectDirectories(projectId, false);
      return await readJsonFile<NoteDocumentFile>(
        directories.templates,
        templateFileName(templateId)
      );
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  public async writeNote(input: {
    projectId: string;
    noteId: string;
    noteDocument: NoteDocumentFile;
    derivedMarkdown: string;
  }): Promise<void> {
    if (input.noteDocument.id !== input.noteId) {
      throw new Error(
        `FileSystemAdapter.writeNote id mismatch for ${input.projectId}:${input.noteId}.`
      );
    }
    const project = await this.readProject(input.projectId);
    if (!project) {
      throw new Error(
        `FileSystemAdapter.writeNote missing project ${input.projectId}.`
      );
    }
    const directories = await this.ensureProjectDirectories(input.projectId);
    await writeJsonFile(
      directories.notes,
      noteFileName(input.noteId),
      input.noteDocument
    );
    await writeTextFile(
      directories.notes,
      noteMarkdownName(input.noteId),
      input.derivedMarkdown
    );

    const updatedProject: Project = {
      ...project,
      updatedAt: Math.max(project.updatedAt, input.noteDocument.updatedAt),
      notesIndex: {
        ...project.notesIndex,
        [input.noteId]: toNoteIndexEntry(input.noteDocument),
      },
    };

    await this.writeProject(input.projectId, updatedProject);
  }

  public async writeTemplate(input: {
    projectId: string;
    templateId: string;
    noteDocument: NoteDocumentFile;
    derivedMarkdown: string;
  }): Promise<void> {
    if (input.noteDocument.id !== input.templateId) {
      throw new Error(
        `FileSystemAdapter.writeTemplate id mismatch for ${input.projectId}:${input.templateId}.`
      );
    }
    const project = await this.readProject(input.projectId);
    if (!project) {
      throw new Error(
        `FileSystemAdapter.writeTemplate missing project ${input.projectId}.`
      );
    }
    const directories = await this.ensureProjectDirectories(input.projectId);
    await writeJsonFile(
      directories.templates,
      templateFileName(input.templateId),
      input.noteDocument
    );
    await writeTextFile(
      directories.templates,
      templateMarkdownName(input.templateId),
      input.derivedMarkdown
    );

    const updatedProject: Project = {
      ...project,
      updatedAt: Math.max(project.updatedAt, input.noteDocument.updatedAt),
      templatesIndex: {
        ...project.templatesIndex,
        [input.templateId]: toTemplateIndexEntry(input.noteDocument),
      },
    };

    await this.writeProject(input.projectId, updatedProject);
  }

  public async deleteNoteSoft(
    projectId: string,
    noteId: string
  ): Promise<void> {
    const project = await this.readProject(projectId);
    if (!project) {
      throw new Error(
        `FileSystemAdapter.deleteNoteSoft missing project ${projectId}.`
      );
    }
    const directories = await this.ensureProjectDirectories(projectId);
    const existing = await this.readNote(projectId, noteId);
    if (!existing) {
      throw new Error(
        `FileSystemAdapter.deleteNoteSoft missing note ${projectId}:${noteId}.`
      );
    }

    const timestamp = Date.now();
    const updatedNote: NoteDocumentFile = {
      ...existing,
      deletedAt: timestamp,
      updatedAt: timestamp,
    };
    const markdown =
      (await readTextFile(directories.notes, noteMarkdownName(noteId))) ?? "";

    await writeJsonFile(directories.trash, noteFileName(noteId), updatedNote);
    await writeTextFile(directories.trash, noteMarkdownName(noteId), markdown);

    await removeEntryIfExists(directories.notes, noteFileName(noteId));
    await removeEntryIfExists(directories.notes, noteMarkdownName(noteId));

    const updatedProject: Project = {
      ...project,
      updatedAt: Math.max(project.updatedAt, timestamp),
      notesIndex: {
        ...project.notesIndex,
        [noteId]: toNoteIndexEntry(updatedNote),
      },
    };

    await this.writeProject(projectId, updatedProject);
  }

  public async restoreNote(projectId: string, noteId: string): Promise<void> {
    const project = await this.readProject(projectId);
    if (!project) {
      throw new Error(
        `FileSystemAdapter.restoreNote missing project ${projectId}.`
      );
    }
    const directories = await this.ensureProjectDirectories(projectId);
    const existing = await readJsonFile<NoteDocumentFile>(
      directories.trash,
      noteFileName(noteId)
    );
    if (!existing) {
      throw new Error(
        `FileSystemAdapter.restoreNote missing note ${projectId}:${noteId}.`
      );
    }
    const timestamp = Date.now();
    const currentFolderId = existing.folderId;
    const restoredFolderId =
      currentFolderId && Object.hasOwn(project.folders, currentFolderId)
        ? currentFolderId
        : null;
    const updatedNote: NoteDocumentFile = {
      ...existing,
      deletedAt: null,
      folderId: restoredFolderId,
      updatedAt: timestamp,
    };
    const markdown =
      (await readTextFile(directories.trash, noteMarkdownName(noteId))) ?? "";

    await writeJsonFile(directories.notes, noteFileName(noteId), updatedNote);
    await writeTextFile(directories.notes, noteMarkdownName(noteId), markdown);

    await removeEntryIfExists(directories.trash, noteFileName(noteId));
    await removeEntryIfExists(directories.trash, noteMarkdownName(noteId));

    const updatedProject: Project = {
      ...project,
      updatedAt: Math.max(project.updatedAt, timestamp),
      notesIndex: {
        ...project.notesIndex,
        [noteId]: toNoteIndexEntry(updatedNote),
      },
    };

    await this.writeProject(projectId, updatedProject);
  }

  public async deleteNotePermanent(
    projectId: string,
    noteId: string
  ): Promise<void> {
    const project = await this.readProject(projectId);
    if (!project) {
      throw new Error(
        `FileSystemAdapter.deleteNotePermanent missing project ${projectId}.`
      );
    }
    const directories = await this.ensureProjectDirectories(projectId);
    const remainingNotesIndex: Record<string, NoteIndexEntry> = {};
    for (const [entryId, entry] of Object.entries(project.notesIndex)) {
      if (entryId !== noteId) {
        remainingNotesIndex[entryId] = entry;
      }
    }

    await removeEntryIfExists(directories.notes, noteFileName(noteId));
    await removeEntryIfExists(directories.notes, noteMarkdownName(noteId));
    await removeEntryIfExists(directories.trash, noteFileName(noteId));
    await removeEntryIfExists(directories.trash, noteMarkdownName(noteId));

    const updatedProject: Project = {
      ...project,
      updatedAt: Math.max(project.updatedAt, Date.now()),
      notesIndex: remainingNotesIndex,
    };

    await this.writeProject(projectId, updatedProject);
  }

  public async deleteTemplate(
    projectId: string,
    templateId: string
  ): Promise<void> {
    const project = await this.readProject(projectId);
    if (!project) {
      throw new Error(
        `FileSystemAdapter.deleteTemplate missing project ${projectId}.`
      );
    }
    const directories = await this.ensureProjectDirectories(projectId);
    const remainingTemplatesIndex: Record<string, TemplateIndexEntry> = {};
    for (const [entryId, entry] of Object.entries(project.templatesIndex)) {
      if (entryId !== templateId) {
        remainingTemplatesIndex[entryId] = entry;
      }
    }

    await removeEntryIfExists(
      directories.templates,
      templateFileName(templateId)
    );
    await removeEntryIfExists(
      directories.templates,
      templateMarkdownName(templateId)
    );

    const updatedProject: Project = {
      ...project,
      updatedAt: Math.max(project.updatedAt, Date.now()),
      templatesIndex: remainingTemplatesIndex,
    };

    await this.writeProject(projectId, updatedProject);
  }

  public async writeAsset(input: {
    projectId: string;
    assetId: string;
    blob: Blob;
    meta?: AssetMeta;
  }): Promise<void> {
    const project = await this.readProject(input.projectId);
    if (project) {
      const directories = await this.ensureProjectDirectories(input.projectId);
      const extension = resolveAssetExtension(
        input.meta?.mime ?? input.blob.type
      );
      const fileName = `${input.assetId}.${extension}`;
      await writeBlobFile(directories.assets, fileName, input.blob);
      return;
    }
    throw new Error(
      `FileSystemAdapter.writeAsset missing project ${input.projectId}.`
    );
  }

  public async readAsset(
    projectId: string,
    assetId: string
  ): Promise<Blob | null> {
    const directories = await this.ensureProjectDirectories(projectId, false);
    const handle = await findAssetHandle(directories.assets, assetId);
    if (handle) {
      return handle.getFile();
    }
    return null;
  }

  public async listAssets(projectId: string): Promise<string[]> {
    try {
      const directories = await this.ensureProjectDirectories(projectId, false);
      const entries = await listDirectoryEntries(directories.assets);
      const assetIds = new Set<string>();
      for (const entry of entries) {
        if (isFileHandle(entry)) {
          const { name } = entry;
          const dotIndex = name.indexOf(".");
          const assetId = dotIndex === -1 ? name : name.slice(0, dotIndex);
          assetIds.add(assetId);
        }
      }
      return [...assetIds];
    } catch (error) {
      if (isNotFoundError(error)) {
        return [];
      }
      throw error;
    }
  }

  public async writeUIState(state: UIState): Promise<void> {
    if (this.cacheAdapter && this.cacheReady) {
      await this.cacheAdapter.writeUIState(state);
      return;
    }
    const manifest = await this.readVaultManifest();
    await this.writeVaultManifest({
      ...manifest,
      uiState: state,
    });
  }

  public async readUIState(): Promise<UIState | null> {
    if (this.cacheAdapter && this.cacheReady) {
      const cached = await this.cacheAdapter.readUIState();
      if (cached) {
        return cached;
      }
    }
    const manifest = await this.readVaultManifest();
    const legacy = manifest.uiState ?? null;
    if (legacy && this.cacheAdapter && this.cacheReady) {
      await this.cacheAdapter.writeUIState(legacy);
    }
    return legacy;
  }

  public async writeSearchIndex(
    projectId: string,
    snapshot: string
  ): Promise<void> {
    if (this.cacheAdapter && this.cacheReady) {
      await this.cacheAdapter.writeSearchIndex(projectId, snapshot);
      return;
    }
    const manifest = await this.readVaultManifest();
    const searchIndex = manifest.searchIndex ?? {};
    await this.writeVaultManifest({
      ...manifest,
      searchIndex: {
        ...searchIndex,
        [projectId]: snapshot,
      },
    });
  }

  public async readSearchIndex(projectId: string): Promise<string | null> {
    if (this.cacheAdapter && this.cacheReady) {
      const cached = await this.cacheAdapter.readSearchIndex(projectId);
      if (cached) {
        return cached;
      }
    }
    const manifest = await this.readVaultManifest();
    const legacy = manifest.searchIndex?.[projectId] ?? null;
    if (legacy && this.cacheAdapter && this.cacheReady) {
      await this.cacheAdapter.writeSearchIndex(projectId, legacy);
    }
    return legacy;
  }

  private async ensureVaultManifest(): Promise<void> {
    const manifest = await readJsonFile<VaultManifest>(
      this.root,
      vaultFileName
    );
    if (!manifest) {
      await this.writeVaultManifest({ version: 1 });
    }
  }

  private async readVaultManifest(): Promise<VaultManifest> {
    const manifest = await readJsonFile<VaultManifest>(
      this.root,
      vaultFileName
    );
    return manifest ?? { version: 1 };
  }

  private async writeVaultManifest(manifest: VaultManifest): Promise<void> {
    await writeJsonFile(this.root, vaultFileName, manifest);
  }

  private async getProjectsDirectory(
    create: boolean
  ): Promise<FileSystemDirectoryHandle> {
    return this.root.getDirectoryHandle(projectsDirectoryName, { create });
  }

  private async getProjectDirectory(
    projectId: string,
    create: boolean
  ): Promise<FileSystemDirectoryHandle> {
    const projectsRoot = await this.getProjectsDirectory(create);
    return projectsRoot.getDirectoryHandle(projectId, { create });
  }

  private async ensureProjectDirectories(
    projectId: string,
    create = true
  ): Promise<ProjectDirectories> {
    const project = await this.getProjectDirectory(projectId, create);
    const notes = await project.getDirectoryHandle(notesDirectoryName, {
      create,
    });
    const templates = await project.getDirectoryHandle(templatesDirectoryName, {
      create,
    });
    const assets = await project.getDirectoryHandle(assetsDirectoryName, {
      create,
    });
    const trash = await project.getDirectoryHandle(trashDirectoryName, {
      create,
    });
    return { project, notes, templates, assets, trash };
  }
}
