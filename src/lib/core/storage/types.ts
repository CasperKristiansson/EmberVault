export type CustomFieldValue =
  | string
  | number
  | boolean
  | {
      type: "date";
      value: number;
    };

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  childFolderIds: string[];
  noteIds?: string[];
};

export type FolderTree = Record<string, Folder>;

export type Tag = {
  id: string;
  name: string;
  color?: string;
};

export type NoteIndexEntry = {
  id: string;
  title: string;
  folderId: string | null;
  tagIds: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  isTemplate: boolean;
  customFields?: Record<string, CustomFieldValue>;
  linkOutgoing?: string[];
  linkIncomingCount?: number;
};

export type TemplateIndexEntry = Omit<NoteIndexEntry, "isTemplate"> & {
  isTemplate: true;
};

export type ProjectSettings = Record<string, unknown>;

export type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  folders: FolderTree;
  tags: Record<string, Tag>;
  notesIndex: Record<string, NoteIndexEntry>;
  templatesIndex: Record<string, TemplateIndexEntry>;
  settings: ProjectSettings;
};

export type NoteDocumentDerived = {
  plainText?: string;
  outgoingLinks?: string[];
};

export type NoteDocumentFile = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  folderId: string | null;
  tagIds: string[];
  favorite: boolean;
  deletedAt: number | null;
  customFields: Record<string, CustomFieldValue>;
  pmDoc: Record<string, unknown>;
  derived?: NoteDocumentDerived;
  isTemplate?: boolean;
};

export type AssetMeta = {
  mime?: string;
  width?: number;
  height?: number;
  size?: number;
};

export type UIState = Record<string, unknown>;

export type AppPreferences = {
  startupView: "last-opened" | "all-notes";
  defaultSort: "updated" | "created" | "title";
  openNoteBehavior: "new-tab" | "reuse-tab";
  confirmTrash: boolean;
  spellcheck: boolean;
};

export type AppSettings = {
  storageMode: "filesystem" | "idb";
  fsHandle?: FileSystemDirectoryHandle;
  lastVaultName?: string;
  settings?: AppPreferences;
};

export type StorageAdapter = {
  init: () => Promise<void>;
  listProjects: () => Promise<Project[]>;
  createProject: (project: Project) => Promise<void>;
  readProject: (projectId: string) => Promise<Project | null>;
  writeProject: (projectId: string, projectMeta: Project) => Promise<void>;
  listNotes: (projectId: string) => Promise<NoteIndexEntry[]>;
  listTemplates: (projectId: string) => Promise<TemplateIndexEntry[]>;
  readNote: (
    projectId: string,
    noteId: string
  ) => Promise<NoteDocumentFile | null>;
  readTemplate: (
    projectId: string,
    templateId: string
  ) => Promise<NoteDocumentFile | null>;
  writeNote: (input: {
    projectId: string;
    noteId: string;
    noteDocument: NoteDocumentFile;
    derivedMarkdown: string;
  }) => Promise<void>;
  writeTemplate: (input: {
    projectId: string;
    templateId: string;
    noteDocument: NoteDocumentFile;
    derivedMarkdown: string;
  }) => Promise<void>;
  deleteNoteSoft: (projectId: string, noteId: string) => Promise<void>;
  restoreNote: (projectId: string, noteId: string) => Promise<void>;
  deleteNotePermanent: (projectId: string, noteId: string) => Promise<void>;
  deleteTemplate: (projectId: string, templateId: string) => Promise<void>;
  writeAsset: (input: {
    projectId: string;
    assetId: string;
    blob: Blob;
    meta?: AssetMeta;
  }) => Promise<void>;
  readAsset: (projectId: string, assetId: string) => Promise<Blob | null>;
  listAssets: (projectId: string) => Promise<string[]>;
  writeUIState: (state: UIState) => Promise<void>;
  readUIState: () => Promise<UIState | null>;
  writeSearchIndex: (projectId: string, snapshot: string) => Promise<void>;
  readSearchIndex: (projectId: string) => Promise<string | null>;
};
