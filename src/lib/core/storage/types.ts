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

export type VaultSettings = Record<string, unknown>;

export type Vault = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  folders: FolderTree;
  tags: Record<string, Tag>;
  notesIndex: Record<string, NoteIndexEntry>;
  templatesIndex: Record<string, TemplateIndexEntry>;
  settings: VaultSettings;
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
  newNoteLocation: "current-folder" | "all-notes";
  confirmTrash: boolean;
  spellcheck: boolean;
  showNoteDates: boolean;
};

export type AppSettings = {
  storageMode: "filesystem" | "idb";
  fsHandle?: FileSystemDirectoryHandle;
  lastVaultName?: string;
  settings?: AppPreferences;
};

export type StorageAdapter = {
  init: () => Promise<void>;
  readVault: () => Promise<Vault | null>;
  writeVault: (vault: Vault) => Promise<void>;
  listNotes: () => Promise<NoteIndexEntry[]>;
  listTemplates: () => Promise<TemplateIndexEntry[]>;
  readNote: (noteId: string) => Promise<NoteDocumentFile | null>;
  readTemplate: (templateId: string) => Promise<NoteDocumentFile | null>;
  writeNote: (input: {
    noteId: string;
    noteDocument: NoteDocumentFile;
    derivedMarkdown: string;
  }) => Promise<void>;
  writeTemplate: (input: {
    templateId: string;
    noteDocument: NoteDocumentFile;
    derivedMarkdown: string;
  }) => Promise<void>;
  deleteNoteSoft: (noteId: string) => Promise<void>;
  restoreNote: (noteId: string) => Promise<void>;
  deleteNotePermanent: (noteId: string) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
  writeAsset: (input: {
    assetId: string;
    blob: Blob;
    meta?: AssetMeta;
  }) => Promise<void>;
  readAsset: (assetId: string) => Promise<Blob | null>;
  listAssets: () => Promise<string[]>;
  writeUIState: (state: UIState) => Promise<void>;
  readUIState: () => Promise<UIState | null>;
  writeSearchIndex: (snapshot: string) => Promise<void>;
  readSearchIndex: () => Promise<string | null>;
};
